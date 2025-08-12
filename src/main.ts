/// <reference types="tampermonkey" />
// @ts-nocheck

import { bootstrapApp } from "./app";

(function () {
  "use strict";
  window.onload = () => {
    bootstrapApp().catch((e) =>
      console.error("Overlay Pro bootstrap failed", e),
    );
  };
})();
export {};

