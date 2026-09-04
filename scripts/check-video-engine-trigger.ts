import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export interface VideoEngineLaunchContext {
  message: string
  userMessageIndex: number
}

export function shouldLaunchVideoEngine(context: VideoEngineLaunchContext): boolean {
  return context.userMessageIndex === 0 && context.message.trim().toLowerCase() === 'video engine'
}

export const VIDEO_ENGINE_TRIGGER_CASES: ReadonlyArray<VideoEngineLaunchContext & { expected: boolean; label: string }> = [
  { label: 'exact', message: 'Video engine', userMessageIndex: 0, expected: true },
  { label: 'case insensitive', message: 'VIDEO ENGINE', userMessageIndex: 0, expected: true },
  { label: 'outer whitespace only', message: ' \r\n Video engine \t', userMessageIndex: 0, expected: true },
  { label: 'terminal punctuation', message: 'Video engine!', userMessageIndex: 0, expected: false },
  { label: 'additional words', message: 'Video engine please', userMessageIndex: 0, expected: false },
  { label: 'additional line', message: 'Video engine\nCreate a Short', userMessageIndex: 0, expected: false },
  { label: 'quoted mention', message: 'Say "Video engine" to begin', userMessageIndex: 0, expected: false },
  { label: 'explicit skill token', message: '$video-engine', userMessageIndex: 0, expected: false },
  { label: 'later turn', message: 'Video engine', userMessageIndex: 1, expected: false },
  { label: 'ordinary video request', message: 'Can you edit this video?', userMessageIndex: 0, expected: false },
]

export async function checkVideoEngineTrigger(repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')): Promise<void> {
  const failures = VIDEO_ENGINE_TRIGGER_CASES.filter((testCase) => shouldLaunchVideoEngine(testCase) !== testCase.expected)
  if (failures.length) throw new Error(`Video Engine trigger contract failed: ${failures.map((item) => item.label).join(', ')}`)

  const skill = await readFile(resolve(repoRoot, '.agents', 'skills', 'video-engine', 'SKILL.md'), 'utf8')
  const metadata = await readFile(resolve(repoRoot, '.agents', 'skills', 'video-engine', 'agents', 'openai.yaml'), 'utf8')
  if (!skill.includes('complete first user message') || !skill.includes('leading and trailing whitespace')) {
    throw new Error('Video Engine skill must state the exact first-message and whitespace-only trigger boundary')
  }
  if (!skill.includes('`Video engine!`') || !skill.includes('`$video-engine`')) {
    throw new Error('Video Engine skill must document punctuation and explicit-token negative cases')
  }
  if (!skill.includes('studio v2 job status')) {
    throw new Error('Video Engine launcher must inspect the V2 queue rather than the legacy V1 status surface')
  }
  if (/Krish(?:an)? Raja/.test(skill)) {
    throw new Error('Video Engine launcher must use Krish as the human-facing name')
  }
  if (!skill.includes(String.raw`G:\My Drive\Ventures\Active\Mindmaker\04\_Content\Video Engine`)) {
    throw new Error('Video Engine launcher must use the exact approved media inbox path')
  }
  if (!/allow_implicit_invocation:\s*true/.test(metadata)) {
    throw new Error('Video Engine must allow implicit selection so the exact bare first prompt can launch it')
  }
  if (/default_prompt:/.test(metadata)) {
    throw new Error('Video Engine metadata must not insert a default prompt that bypasses the exact bare-message contract')
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  await checkVideoEngineTrigger()
  process.stdout.write('Video Engine trigger contract passed\n')
}
