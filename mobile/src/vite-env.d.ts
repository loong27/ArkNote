/// <reference types="vite/client" />

declare module 'isomorphic-git/http/web' {
  import type { HttpClient } from 'isomorphic-git'
  const http: HttpClient
  export default http
}
