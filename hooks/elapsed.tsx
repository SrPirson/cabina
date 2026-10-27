// Cronómetro que avanza con el reloj de la superficie: el panel no se redibuja cada segundo.
// `since` y `now` vienen del módulo de hooks; entre dibujos suma sus propios segundos.
import type { ClientModule } from 'claude-code'

import { span } from './span'

type Props = { since: number; now: number; color?: string; dim?: boolean }
type Ref = { lastNow: number; ticks: number }

const Elapsed: ClientModule<Props, { ref: Ref }> = (props, surface) => {
  const { Text } = surface.elements
  const ref = surface.state?.ref ?? { lastNow: -1, ticks: 0 }
  // Una lectura nueva del módulo de hooks reinicia la cuenta local.
  if (props.now !== ref.lastNow) {
    ref.lastNow = props.now
    ref.ticks = 0
  }
  if (surface.state === undefined) {
    surface.setState({ ref })
    surface.every(1000, () => {
      ref.ticks++
      surface.setState({ ref })
    })
  }
  return <Text color={props.color} dimColor={props.dim}>{span(props.now + ref.ticks * 1000 - props.since)}</Text>
}

export default Elapsed
