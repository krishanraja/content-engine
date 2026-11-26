import { withContentRun } from '../_runs.js'
import { cron } from '../../lib/hub/pipeline.js'

const handler = cron('daily')
export default withContentRun('hub_edition', handler)
