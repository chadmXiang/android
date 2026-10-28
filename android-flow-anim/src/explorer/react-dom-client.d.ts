// 项目没装 @types/react-dom，浏览页只用到 createRoot
declare module 'react-dom/client' {
  import type {ReactNode} from 'react';
  export function createRoot(container: Element): {render(node: ReactNode): void};
}
