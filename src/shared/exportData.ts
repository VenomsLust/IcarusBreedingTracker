import { STAT_NAMES, type Animal, type SpeciesDefinition } from './types'
import { computeScore, computeTotal } from './scoring'

export interface ExportAnimalRow {
  name: string
  sex: string
  sire: string
  dam: string
  bloodline: string
  phenotype: string
  status: string
  prospect: string
  stats: Record<string, number>
  total: number
  score: number
}

export function buildExportRows(
  animals: Animal[],
  species: SpeciesDefinition,
  animalNameById: Map<string, string>,
  prospectNameById: Map<string, string>
): ExportAnimalRow[] {
  return animals.map((a) => ({
    name: a.name,
    sex: a.sex,
    sire: a.sireId ? animalNameById.get(a.sireId) ?? '' : 'Wild Caught',
    dam: a.damId ? animalNameById.get(a.damId) ?? '' : 'Wild Caught',
    bloodline: a.bloodline,
    phenotype: a.phenotype ?? 'Base',
    status: a.status ?? 'active',
    prospect: a.prospectId ? prospectNameById.get(a.prospectId) ?? '' : 'Unassigned',
    stats: { ...a.stats },
    total: computeTotal(a.stats),
    score: computeScore(a.stats, a.bloodline, a.phenotype, species.scoreConfig)
  }))
}

export function toExportJson(speciesName: string, prospectLabel: string, rows: ExportAnimalRow[]): string {
  return JSON.stringify(
    { species: speciesName, prospect: prospectLabel, exportedAt: new Date().toISOString(), animals: rows },
    null,
    2
  )
}

function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function toExportXml(speciesName: string, prospectLabel: string, rows: ExportAnimalRow[]): string {
  const animalXml = rows
    .map((r) => {
      const statsAttrs = STAT_NAMES.map((s) => `${s}="${escapeXml(r.stats[s])}"`).join(' ')
      return (
        `  <animal name="${escapeXml(r.name)}" sex="${escapeXml(r.sex)}" sire="${escapeXml(r.sire)}" ` +
        `dam="${escapeXml(r.dam)}" bloodline="${escapeXml(r.bloodline)}" phenotype="${escapeXml(r.phenotype)}" ` +
        `status="${escapeXml(r.status)}" prospect="${escapeXml(r.prospect)}">\n` +
        `    <stats ${statsAttrs} />\n` +
        `    <total>${r.total}</total>\n` +
        `    <score>${r.score}</score>\n` +
        `  </animal>`
      )
    })
    .join('\n')

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<export species="${escapeXml(speciesName)}" prospect="${escapeXml(prospectLabel)}" exportedAt="${new Date().toISOString()}">\n` +
    `${animalXml}\n` +
    `</export>\n`
  )
}
