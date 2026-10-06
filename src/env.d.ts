/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    usuario: import('./server/auth').Usuario | null;
  }
}
