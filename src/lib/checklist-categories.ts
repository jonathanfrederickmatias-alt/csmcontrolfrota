// Categorização automática de equipamentos a partir do nome/modelo já cadastrado.
// Nenhuma categoria é criada para tipos que não existem na frota: a lista abaixo
// cobre apenas os tipos identificados na base.

export type ChecklistTemplateItem = {
  id: string;
  label: string;
  group?: string;
};

export type CategoryDef = {
  key: string;
  label: string;
  keywords: string[];
};

// A ordem importa: a primeira categoria cujo palavra-chave aparecer no nome/modelo vence.
export const CHECKLIST_CATEGORIES: CategoryDef[] = [
  { key: 'vibroacabadora', label: 'Vibroacabadora', keywords: ['VIBROACABADORA', 'ACABADORA'] },
  { key: 'rolo_pneu', label: 'Rolo Pneu', keywords: ['ROLO PNEU', 'ROLO DE PNEU'] },
  { key: 'rolo_chapa', label: 'Rolo Chapa', keywords: ['ROLO CHAPA', 'ROLO TANDEM', 'ROLO LISO', 'ROLO'] },
  { key: 'fresadora', label: 'Fresadora', keywords: ['FRESADORA'] },
  { key: 'minicarregadeira', label: 'Minicarregadeira', keywords: ['MINICARREGADEIRA', 'MINI CARREGADEIRA'] },
  { key: 'usina', label: 'Usina', keywords: ['USINA'] },
  { key: 'comboio', label: 'Comboio', keywords: ['COMBOIO'] },
  { key: 'posto', label: 'Posto de Combustível', keywords: ['POSTO'] },
  { key: 'caminhao', label: 'Caminhão', keywords: ['CAMINHAO', 'CAMINHÃO', 'CAVALO', 'CARRETA', 'ESPARGIDOR', 'BASCULANTE'] },
  {
    key: 'veiculo_leve',
    label: 'Veículo Leve',
    keywords: ['CARRO', 'VAN ', 'VAN', 'FURGAO', 'FURGÃO', 'CAMINHONETE', 'CAMIONETE', 'PICKUP', 'PICK-UP', 'MONTANA', 'STRADA', 'S10', 'SAVEIRO', 'KOMBI'],
  },
];

const norm = (v?: string | null) =>
  (v || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function detectCategory(eq: { name?: string | null; model?: string | null; type?: string | null }): CategoryDef {
  const haystack = `${norm(eq.name)} ${norm(eq.model)}`;
  for (const cat of CHECKLIST_CATEGORIES) {
    if (cat.keywords.some((k) => haystack.includes(norm(k)))) return cat;
  }
  // Fallback pelo tipo cadastrado
  if (eq.type === 'truck') return CHECKLIST_CATEGORIES.find((c) => c.key === 'caminhao')!;
  if (eq.type === 'combo') return CHECKLIST_CATEGORIES.find((c) => c.key === 'comboio')!;
  return CHECKLIST_CATEGORIES.find((c) => c.key === 'caminhao')!;
}

export function categoryLabel(key: string) {
  return CHECKLIST_CATEGORIES.find((c) => c.key === key)?.label || key;
}

const mk = (group: string, labels: string[]): ChecklistTemplateItem[] =>
  labels.map((label, i) => ({ id: `${group}-${i}-${label}`.toLowerCase().replace(/\s+/g, '-').slice(0, 60), label, group }));

// Modelo padrão de Caminhão = checklist atual do sistema (mantido igual).
const CAMINHAO_ITEMS: ChecklistTemplateItem[] = [
  ...mk('Motor', ['Nível de óleo do motor', 'Nível de água/refrigerante', 'Vazamentos visíveis', 'Correias']),
  ...mk('Hidráulica', ['Nível de óleo hidráulico']),
  ...mk('Rodagem', ['Condições dos pneus/esteiras', 'Calibração dos pneus', 'Freios']),
  ...mk('Elétrica', ['Luzes e sinalização', 'Funcionamento dos instrumentos do painel']),
  ...mk('Cabine', ['Limpador de para-brisa', 'Estado geral de limpeza', 'Condições do Tacógrafo']),
  ...mk('Segurança', ['Cintos e dispositivos de segurança', 'Extintor de incêndio']),
];

export const DEFAULT_TEMPLATES: Record<string, ChecklistTemplateItem[]> = {
  caminhao: CAMINHAO_ITEMS,
  veiculo_leve: [
    ...mk('Motor', ['Nível de óleo do motor', 'Nível de água/refrigerante', 'Vazamentos visíveis']),
    ...mk('Rodagem', ['Condições dos pneus', 'Calibração dos pneus', 'Estepe e macaco', 'Freios']),
    ...mk('Elétrica', ['Luzes e sinalização', 'Buzina', 'Painel de instrumentos']),
    ...mk('Cabine', ['Limpador de para-brisa', 'Ar-condicionado', 'Estado geral de limpeza']),
    ...mk('Segurança', ['Cintos de segurança', 'Extintor de incêndio', 'Triângulo', 'Documentação do veículo']),
  ],
  vibroacabadora: [
    ...mk('Motor', ['Nível de óleo do motor', 'Nível de água/refrigerante', 'Filtro de ar', 'Vazamentos visíveis']),
    ...mk('Hidráulica', ['Nível de óleo hidráulico', 'Mangueiras e conexões', 'Cilindros da mesa']),
    ...mk('Mesa/Régua', ['Aquecimento da mesa', 'Nivelamento da mesa', 'Vibradores da mesa', 'Estado das chapas de desgaste']),
    ...mk('Alimentação', ['Esteiras transportadoras', 'Roscas distribuidoras', 'Silo e comportas']),
    ...mk('Rodagem', ['Esteiras/pneus de tração', 'Rolamentos e roletes']),
    ...mk('Elétrica', ['Painel de comando', 'Sensores de nivelamento', 'Iluminação de trabalho']),
    ...mk('Segurança', ['Botão de emergência', 'Alarme de ré', 'Extintor de incêndio', 'Sinalização']),
  ],
  rolo_pneu: [
    ...mk('Motor', ['Nível de óleo do motor', 'Nível de água/refrigerante', 'Filtro de ar', 'Vazamentos visíveis']),
    ...mk('Hidráulica', ['Nível de óleo hidráulico', 'Mangueiras e conexões']),
    ...mk('Rodagem', ['Estado dos pneus', 'Calibração dos pneus', 'Lastro', 'Freios']),
    ...mk('Aspersão', ['Nível de água do tanque', 'Bicos aspersores', 'Bomba de água', 'Saia térmica']),
    ...mk('Elétrica', ['Painel de instrumentos', 'Luzes e sinalização', 'Bateria']),
    ...mk('Segurança', ['Alarme de ré', 'Botão de emergência', 'Extintor de incêndio', 'Cinto de segurança']),
  ],
  rolo_chapa: [
    ...mk('Motor', ['Nível de óleo do motor', 'Nível de água/refrigerante', 'Filtro de ar', 'Vazamentos visíveis']),
    ...mk('Hidráulica', ['Nível de óleo hidráulico', 'Mangueiras e conexões', 'Comando de vibração']),
    ...mk('Cilindros', ['Estado dos cilindros/tambores', 'Raspadores', 'Coxins e amortecedores', 'Sistema de vibração']),
    ...mk('Aspersão', ['Nível de água do tanque', 'Bicos aspersores', 'Bomba de água']),
    ...mk('Elétrica', ['Painel de instrumentos', 'Luzes e sinalização', 'Bateria']),
    ...mk('Segurança', ['Alarme de ré', 'Botão de emergência', 'Extintor de incêndio', 'Cinto de segurança']),
  ],
  fresadora: [
    ...mk('Motor', ['Nível de óleo do motor', 'Nível de água/refrigerante', 'Filtro de ar', 'Vazamentos visíveis']),
    ...mk('Hidráulica', ['Nível de óleo hidráulico', 'Mangueiras e conexões', 'Cilindros de nivelamento']),
    ...mk('Tambor de Fresagem', ['Estado dos dentes/bits', 'Porta-dentes', 'Correia do tambor', 'Caixa de fresagem']),
    ...mk('Transporte', ['Esteiras transportadoras', 'Roletes e tensionamento', 'Raspadores']),
    ...mk('Aspersão', ['Nível de água do tanque', 'Bicos de água', 'Bomba de água']),
    ...mk('Rodagem', ['Esteiras/sapatas', 'Estado das colunas']),
    ...mk('Elétrica', ['Painel de comando', 'Sensores de nivelamento', 'Iluminação de trabalho']),
    ...mk('Segurança', ['Botão de emergência', 'Alarme de ré', 'Extintor de incêndio', 'Proteções e grades']),
  ],
  minicarregadeira: [
    ...mk('Motor', ['Nível de óleo do motor', 'Nível de água/refrigerante', 'Filtro de ar', 'Vazamentos visíveis']),
    ...mk('Hidráulica', ['Nível de óleo hidráulico', 'Mangueiras e conexões', 'Engates rápidos', 'Cilindros da caçamba']),
    ...mk('Rodagem', ['Estado dos pneus/esteiras', 'Calibração dos pneus']),
    ...mk('Implemento', ['Estado da caçamba/implemento', 'Pinos e travas', 'Lubrificação dos pinos']),
    ...mk('Elétrica', ['Painel de instrumentos', 'Luzes de trabalho', 'Bateria']),
    ...mk('Segurança', ['Cinto de segurança', 'Barra de segurança', 'Alarme de ré', 'Extintor de incêndio']),
  ],
  usina: [
    ...mk('Motor/Gerador', ['Nível de óleo', 'Nível de combustível', 'Vazamentos visíveis', 'Gerador']),
    ...mk('Processo', ['Silos e comportas', 'Esteiras transportadoras', 'Misturador', 'Balanças e dosadores']),
    ...mk('Ligante', ['Bomba de emulsão/ligante', 'Mangueiras e válvulas', 'Nível dos tanques']),
    ...mk('Elétrica', ['Painel de comando', 'Botoeiras', 'Iluminação']),
    ...mk('Segurança', ['Botão de emergência', 'Proteções de correias', 'Extintor de incêndio', 'Sinalização']),
  ],
  comboio: [
    ...mk('Motor', ['Nível de óleo do motor', 'Nível de água/refrigerante', 'Vazamentos visíveis']),
    ...mk('Rodagem', ['Condições dos pneus', 'Calibração dos pneus', 'Freios']),
    ...mk('Tanque/Bomba', ['Estado do tanque', 'Bomba de abastecimento', 'Mangueiras e bicos', 'Vazamento de combustível', 'Aterramento']),
    ...mk('Elétrica', ['Luzes e sinalização', 'Painel de instrumentos']),
    ...mk('Segurança', ['Extintor de incêndio', 'Kit de emergência ambiental', 'Sinalização de produto perigoso', 'Cinto de segurança']),
  ],
  posto: [
    ...mk('Tanque', ['Estado do tanque', 'Vazamentos', 'Nível de combustível']),
    ...mk('Bomba', ['Bomba de abastecimento', 'Mangueiras e bicos', 'Medidor/totalizador']),
    ...mk('Segurança', ['Extintor de incêndio', 'Aterramento', 'Contenção/bacia', 'Sinalização']),
  ],
};

export function defaultItemsFor(categoryKey: string): ChecklistTemplateItem[] {
  return DEFAULT_TEMPLATES[categoryKey] || CAMINHAO_ITEMS;
}
