export interface MatrixValidation {
  errors: string[];
  required: number;
  rows: number;
  green: number;
  red: number;
  na: number;
}

export function buildMatrix(root?: string): string;
export function validateMatrix(root?: string): MatrixValidation;
