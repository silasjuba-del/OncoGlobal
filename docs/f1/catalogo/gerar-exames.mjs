import fs from 'fs';
const [procs, out] = process.argv.slice(2);
const T = new Map(fs.readFileSync(procs, 'utf8').split('\n').filter(Boolean).map(l => [l.slice(0, 10), l.slice(10).trim()]));
const C = {
  imagem: [['TC_CRANIO','0206010079'],['TC_PESCOCO','0206010052'],['TC_TORAX','0206020031'],['TC_ABDOMEN_SUPERIOR','0206030010'],['TC_PELVE','0206030037'],['TC_COLUNA_CERVICAL','0206010010'],['TC_COLUNA_TORACICA','0206010036'],['TC_COLUNA_LOMBAR','0206010028'],['CONTRASTE_TC','0206030045','campo do pedido (angio, uro, TEP)'],
    ['RM_CRANIO','0207010064'],['RM_COLUNA_CERVICAL','0207010030'],['RM_COLUNA_TORACICA','0207010056'],['RM_COLUNA_LOMBAR','0207010048'],['RM_MAMA','0207020060'],['RM_ABDOMEN_SUPERIOR','0207030014'],['RM_PELVE','0207030022','reto, colo'],['RM_PROSTATA_MP','0207030057'],['COLANGIO_RM','0207030049'],['CONTRASTE_RM','0206030053','campo do pedido'],
    ['USG_TIREOIDE','0205020127'],['USG_ABDOMEN_SUPERIOR','0205020038'],['USG_ABDOMEN_TOTAL','0205020046'],['USG_RINS_VIAS','0205020054'],['USG_PELVICA','0205020160'],['USG_TRANSVAGINAL','0205020186'],['USG_PROSTATA_TRANSRETAL','0205020119'],['USG_BOLSA_ESCROTAL','0205020070'],['USG_TORAX','0205020135','derrame pleural'],['USG_MAMAS_BILATERAL','0205020097','inclui axilas na prática'],['USG_AXILAS',null,'sem código SUS; usar USG mamária bilateral'],['USG_DOPPLER_VASOS','0205010040','região no texto do pedido (TVP, cervical)'],
    ['MAMOGRAFIA_DIAGNOSTICA','0204030030'],['RX_TORAX_PA_PERFIL','0204030153'],['DENSITOMETRIA_OSSEA','0204060028','IA, ADT, corticoide']],
  medicina_nuclear: [['CINTILOGRAFIA_OSSEA','0208050027','alternativa 0208050035 com fluxo'],['PCI_IODO','0208030042','pesquisa de corpo inteiro, tireoide'],['PET_CT_FDG','0206010095','indicações Conitec'],['PET_PSMA',null,'sem código SUS'],['PET_DOTATATE',null,'sem código SUS'],['OCTREOSCAN',null,'sem código SUS']],
  endoscopia: [['EDA','0209010037'],['COLONOSCOPIA','0209010029'],['RETOSSIGMOIDOSCOPIA','0209010053'],['CPRE','0209010010'],['BRONCOSCOPIA','0209040017'],['CISTOSCOPIA','0209020016'],['LARINGOSCOPIA','0209040025'],['VIDEOLARINGOSCOPIA','0209040041'],['HISTEROSCOPIA_DIAGNOSTICA',null,'sem código SUS; só a cirúrgica 0209030011']],
  funcao_orgao: [['ECOCARDIOGRAMA','0205010032','FEVE: antraciclina, anti-HER2'],['VENTRICULOGRAFIA_MUGA','0208010084','FEVE, alternativa ao eco'],['ECG','0211020036','QTc'],['ESPIROMETRIA','0211080055','bleomicina'],['AUDIOMETRIA_TONAL','0211070041','cisplatina']],
  biopsia_patologia: [['BIOPSIA_PERCUTANEA_GUIADA','0201010542'],['BIOPSIA_GANGLIO','0201010224'],['BIOPSIA_MAMA','0201010569'],['PAAF_TIREOIDE','0201010470'],['BIOPSIA_PLEURA','0201010402'],['BIOPSIA_FIGADO_PUNCAO','0201010216'],['BIOPSIA_MEDULA','0201010275'],['MIELOGRAMA','0202090191'],['ANATOMOPATOLOGICO','0203020030'],['ANATOMOPATOLOGICO_MAMA_BIOPSIA','0203020065'],['IMUNOHISTOQUIMICA','0203020049','por marcador'],['HER2_QUANTIFICACAO','0202100049'],['FISH','0202100090'],['IMUNOFENOTIPAGEM','0202030237']],
  labs_ciclo: [['HEMOGRAMA','0202020380'],['CREATININA','0202010317'],['UREIA','0202010694'],['TGO','0202010643'],['TGP','0202010651'],['BILIRRUBINA','0202010201'],['FOSFATASE_ALCALINA','0202010422'],['GAMA_GT','0202010465'],['SODIO','0202010635'],['POTASSIO','0202010600'],['MAGNESIO','0202010562'],['CALCIO','0202010210'],['CALCIO_IONICO','0202010228'],['FOSFORO','0202010430'],['ACIDO_URICO','0202010120','lise tumoral'],['DHL','0202010368'],['PROTEINAS_TOTAIS_FRACOES','0202010627','albumina'],['GLICEMIA','0202010473'],['TAP','0202020142'],['TTPA','0202020134'],['URINA_TIPO_I','0202050017'],['PROTEINURIA_24H','0202050114','bevacizumabe'],['CLEARANCE_CREATININA','0202050025']],
  labs_suporte: [['HBA1C','0202010503'],['COLESTEROL_TOTAL','0202010295'],['COLESTEROL_HDL','0202010279'],['COLESTEROL_LDL','0202010287'],['TRIGLICERIDEOS','0202010678'],['AMILASE','0202010180'],['LIPASE','0202010554'],['FIBRINOGENIO','0202020290'],['PCR','0202030202'],['BNP','0202010791'],['TROPONINA','0202031209'],['FERRITINA','0202010384'],['FERRO_SERICO','0202010392'],['TRANSFERRINA','0202010660'],['VITAMINA_B12','0202010708'],['FOLATO','0202010406'],['VITAMINA_D','0202010767'],['RETICULOCITOS','0202020037']],
  sorologias_pre_qt: [['HBSAG','0202031446'],['ANTI_HBC_TOTAL','0202030784'],['ANTI_HBS','0202030636'],['ANTI_HCV','0202031470'],['HIV','0202031500']],
  endocrino: [['TSH','0202060250'],['T4_LIVRE','0202060381'],['CORTISOL','0202060136','imunoterapia'],['PTH','0202060276'],['FSH','0202060233'],['LH','0202060241'],['ESTRADIOL','0202060160'],['TESTOSTERONA_TOTAL','0202060349','castração'],['TESTOSTERONA_LIVRE','0202060357']],
  marcadores_tumorais: [['CEA','0202030962',null,['colon','reto','mama','pulmao']],['PSA_TOTAL','0202030105',null,['prostata']],['CA125','0202031217',null,['ovario']],['AFP','0202030091',null,['figado','germinativo']],['BETA_HCG','0202060217',null,['germinativo','trofoblastico']],['TIREOGLOBULINA','0202060365',null,['tireoide']],['CALCITONINA','0202060128',null,['tireoide_medular']],['ACIDO_5HIAA','0202060071',null,['neuroendocrino']],['BETA2_MICROGLOBULINA','0202030113',null,['mieloma','linfoma']],['CA153',null,'sem código SUS',['mama']],['CA199',null,'sem código SUS',['pancreas','vias_biliares']],['PSA_LIVRE',null,'sem código SUS',['prostata']]],
  mieloma: [['ELETROFORESE_PROTEINAS','0202010724'],['IMUNOELETROFORESE','0202030229'],['CADEIAS_LEVES','0202050181']]
};
const NOMES = { USG_AXILAS: 'USG de axilas', PET_PSMA: 'PET-PSMA', PET_DOTATATE: 'PET com gálio-DOTATATE', OCTREOSCAN: 'Octreoscan', HISTEROSCOPIA_DIAGNOSTICA: 'Histeroscopia diagnóstica', CA153: 'CA 15-3', CA199: 'CA 19-9', PSA_LIVRE: 'PSA livre' };
let n = 0; const erro = []; const ids = new Set();
const res = { header: { id: 'exames-sigtap', versao: '1.0.0', vigenteDesde: '2026-10-11', curador: 'Dr. Silas Negrão', aprovadoEm: 'PENDENTE (RASCUNHO, não aprovado)',
  fonte: { tipo: 'NORMA', referencia: 'corpus/f0c/sigtap/fontes/TabelaUnificada_202609_v2610050950.zip, tb_procedimento', trecho: null, edicao: '2026-09' },
 }, status: 'RASCUNHO', competencia: '2026-09', nota: 'Nomes copiados do ZIP oficial por script. sigtap null = sem código no SIGTAP 09/2026. Contraste é campo do pedido. Só segmentos de uso oncológico prático. Promoção a VERIFICADO: Dr. Silas.', categorias: {} };
for (const [cat, its] of Object.entries(C)) {
  res.categorias[cat] = its.map(([id, c, nota, tum]) => {
    n++; if (ids.has(id)) erro.push('dup ' + id); ids.add(id);
    let nome = NOMES[id];
    if (c) { nome = T.get(c); if (!nome) erro.push(id + ' ' + c); }
    const o = { id, nome, sigtap: c, status: c ? 'RASCUNHO' : 'SEM_CODIGO_SUS' };
    if (tum) o.tumores = tum; if (nota) o.notas = nota; return o;
  });
}
if (erro.length) { console.error('ERRO', erro); process.exit(1); }
fs.writeFileSync(out, JSON.stringify(res, null, 2) + '\n'); console.log(n, 'itens');
