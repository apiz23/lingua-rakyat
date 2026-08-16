import type { ReactNode } from "react";

export type Style = Record<string, unknown>;

export interface PDFComponentProps {
  style?: Style;
  children: ReactNode;
}