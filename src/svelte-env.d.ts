declare module "*.svelte" {
  import { Component } from "svelte";
  const component: Component<any, any, any>;
  export default component;
}
