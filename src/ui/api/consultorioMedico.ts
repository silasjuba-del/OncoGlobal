import { z } from "zod";
import { SaidasConsultorioMedico, type ApiConsultorioMedico } from "../../contracts/api/consultorioMedico.js";

type Enviar = (rota: string, corpo: unknown, signal?: AbortSignal) => Promise<{ status: number; json: unknown }>;
export function criarApiConsultorioMedico(enviar: Enviar): ApiConsultorioMedico {
  async function chamar<T>(rota: string, corpo: unknown, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
    const r = await enviar(rota, corpo, signal);
    if (r.status < 200 || r.status >= 300) {
      const codigo = r.json && typeof r.json === "object" && "codigo" in r.json ? String(r.json.codigo) : "CONSULTORIO_INDISPONIVEL";
      throw new Error(codigo);
    }
    const parsed = schema.safeParse(r.json);
    if (!parsed.success) throw new Error("CONSULTORIO_PAYLOAD_INVALIDO");
    return parsed.data;
  }
  return {
    agenda: (p, s) => chamar("/medico/agenda", p, SaidasConsultorioMedico["/medico/agenda"], s),
    cadastrar: p => chamar("/medico/paciente/cadastrar", p, SaidasConsultorioMedico["/medico/paciente/cadastrar"]),
    paciente: (p, s) => chamar("/medico/paciente/ler", p, SaidasConsultorioMedico["/medico/paciente/ler"], s),
    alterarPaciente: p => chamar("/medico/paciente/alterar", p, SaidasConsultorioMedico["/medico/paciente/alterar"]),
    agendar: p => chamar("/medico/agenda/agendar", p, SaidasConsultorioMedico["/medico/agenda/agendar"]),
    alterarAgenda: p => chamar("/medico/agenda/alterar", p, SaidasConsultorioMedico["/medico/agenda/alterar"]),
    preConsulta: (p, s) => chamar("/medico/preconsulta", p, SaidasConsultorioMedico["/medico/preconsulta"], s),
    salvarPreConsulta: p => chamar("/medico/preconsulta/salvar", p, SaidasConsultorioMedico["/medico/preconsulta/salvar"]),
    confirmarPreConsulta: p => chamar("/medico/preconsulta/confirmar", p, SaidasConsultorioMedico["/medico/preconsulta/confirmar"]),
    nutricao: (p, s) => chamar("/medico/nutricao", p, SaidasConsultorioMedico["/medico/nutricao"], s),
    salvarNutricao: p => chamar("/medico/nutricao/salvar", p, SaidasConsultorioMedico["/medico/nutricao/salvar"]),
  };
}
