import { defineConfig } from 'vitest/config';
// Critérios futuros audit_only: falhas são reportadas, não corrigidas ou disfarçadas de sucesso.
export default defineConfig({test:{include:['tests/auditoria9a12/*.audit.ts'],maxWorkers:1}});
