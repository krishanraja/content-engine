import { withContentRun } from '../_runs.js'
import { cron } from '../../lib/hub/pipeline.js'

const handler = cron('prices')
export default withContentRun('hub_prices', handler)
