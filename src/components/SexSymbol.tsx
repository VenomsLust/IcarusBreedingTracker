import type { Sex } from '@shared/types'

const SEX_SYMBOLS: Record<Sex, string> = { Male: '♂', Female: '♀' }

interface Props {
  sex: Sex
}

export default function SexSymbol({ sex }: Props): JSX.Element {
  return (
    <span className={`sex-symbol sex-${sex.toLowerCase()}`} title={sex}>
      {SEX_SYMBOLS[sex]}
    </span>
  )
}
