/**
 * 収集されたファイルの情報を表すオブジェクト
 */
export interface ScannedFile {
  relativePath: string;
  file: File;
}

/**
 * スキャン結果としてコールバックに渡されるコンテキスト
 */
export interface DropResult {
  files: ScannedFile[];
  isFallbackMode: boolean;
}

/**
 * モジュールの初期化オプション
 */
export interface FileDropScannerOptions {
  target: HTMLElement | string;
  hoverClass?: string;
  onDrop: (result: DropResult) => void | Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * ドラッグ＆ドロップによるファイルおよびフォルダの再帰的走査を管理するクラス
 */
export class FileDropScanner {
  private targetElement: HTMLElement | null = null;
  private hoverClass: string;
  private onDropCallback: (result: DropResult) => void | Promise<void>;
  private onErrorCallback?: (error: Error) => void;

  constructor(options: FileDropScannerOptions) {
    if (typeof options.target === "string") {
      this.targetElement = document.querySelector(options.target);
    } else {
      this.targetElement = options.target;
    }

    this.hoverClass = options.hoverClass || "dragover";
    this.onDropCallback = options.onDrop;
    this.onErrorCallback = options.onError;

    if (this.targetElement) {
      this.initialize();
    }
  }

  private initialize(): void {
    window.addEventListener("dragover", this.preventWindowDefault);
    window.addEventListener("drop", this.preventWindowDefault);

    this.targetElement?.addEventListener("dragover", this.handleDragOver);
    this.targetElement?.addEventListener("dragleave", this.handleDragLeave);
    this.targetElement?.addEventListener("drop", this.handleDrop);
  }

  /**
   * 登録されたすべてのイベントリスナーを解除してリソースを解放します
   */
  public destroy(): void {
    window.removeEventListener("dragover", this.preventWindowDefault);
    window.removeEventListener("drop", this.preventWindowDefault);

    this.targetElement?.removeEventListener("dragover", this.handleDragOver);
    this.targetElement?.removeEventListener("dragleave", this.handleDragLeave);
    this.targetElement?.removeEventListener("drop", this.handleDrop);
  }

  private preventWindowDefault = (e: DragEvent): void => {
    e.preventDefault();
  };

  private handleDragOver = (): void => {
    this.targetElement?.classList.add(this.hoverClass);
  };

  private handleDragLeave = (): void => {
    this.targetElement?.classList.remove(this.hoverClass);
  };

  private handleDrop = async (e: DragEvent): Promise<void> => {
    e.preventDefault();
    this.targetElement?.classList.remove(this.hoverClass);

    const items = e.dataTransfer?.items;
    const rawFiles = e.dataTransfer?.files;
    if (!rawFiles) return;

    let scannedFiles: ScannedFile[] = [];
    let isFallbackMode = false;

    if (items && items.length > 0) {
      try {
        const entries: FileSystemEntry[] = [];
        for (const item of Array.from(items)) {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            entries.push(entry);
          }
        }

        for (const entry of entries) {
          const files = await this.collectFilesViaEntries(entry);
          scannedFiles.push(...files);
        }
      } catch (err) {
        isFallbackMode = true;
      }
    } else {
      isFallbackMode = true;
    }

    if (isFallbackMode) {
      for (const file of Array.from(rawFiles)) {
        const relativePath = file.webkitRelativePath || file.name;
        scannedFiles.push({ relativePath, file });
      }
    }

    try {
      await this.onDropCallback({ files: scannedFiles, isFallbackMode });
    } catch (err) {
      if (this.onErrorCallback && err instanceof Error) {
        this.onErrorCallback(err);
      } else {
        console.error(err);
      }
    }
  };

  /**
   * FileSystemEntryを再帰的に走査し、相対パス情報を持ったファイル配列を収集します
   */
  private async collectFilesViaEntries(
    entry: FileSystemEntry,
    currentPath = "",
  ): Promise<ScannedFile[]> {
    const results: ScannedFile[] = [];

    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });

      const relativePath = currentPath
        ? `${currentPath}/${file.name}`
        : file.name;
      results.push({ relativePath, file });
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const dirReader = dirEntry.createReader();

      const entries = await new Promise<FileSystemEntry[]>(
        (resolve, reject) => {
          dirReader.readEntries(resolve, reject);
        },
      );

      const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      for (const childEntry of entries) {
        const childFiles = await this.collectFilesViaEntries(
          childEntry,
          newPath,
        );
        results.push(...childFiles);
      }
    }

    return results;
  }
}
