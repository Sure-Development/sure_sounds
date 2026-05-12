const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')

const REMOTE_URL = 'https://github.com/Sure-Development/sure_sounds'
const ROOT_DIR = path.resolve(__dirname, '..')
const LOCAL_INTEGRITY_PATH = path.join(ROOT_DIR, 'INTEGRITY')
const UPDATE_DIR = path.join(ROOT_DIR, '.sure_sounds_update')

function normalize(value) {
  if (Array.isArray(value)) {
    return value.map(normalize)
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = normalize(value[key])
        return result
      }, {})
  }
  return value
}

function stableStringify(value) {
  return JSON.stringify(normalize(value), null, 2)
}

async function readJson(filePath) {
  try {
    const text = await fsp.readFile(filePath, 'utf8')
    return JSON.parse(text)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function removeDirectory(dir) {
  try {
    await fsp.rm(dir, { recursive: true, force: true })
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

async function cloneRepository(dir) {
  await removeDirectory(dir)
  await fsp.mkdir(dir, { recursive: true })

  console.log(`📦 Cloning repository to ${dir} ...`)
  await git.clone({
    fs,
    http,
    dir,
    url: REMOTE_URL,
    singleBranch: true,
    depth: 1,
    noCheckout: false,
  })
}

function integritiesMatch(localIntegrity, remoteIntegrity) {
  if (!localIntegrity || !remoteIntegrity) {
    return false
  }
  return stableStringify(localIntegrity) === stableStringify(remoteIntegrity)
}

async function main() {
  const localIntegrity = await readJson(LOCAL_INTEGRITY_PATH)
  await cloneRepository(UPDATE_DIR)

  const remoteIntegrityPath = path.join(UPDATE_DIR, 'INTEGRITY')
  const remoteIntegrity = await readJson(remoteIntegrityPath)

  if (!remoteIntegrity) {
    console.error('❌ Remote INTEGRITY file not found in cloned repository.')
    await removeDirectory(UPDATE_DIR)
    process.exit(1)
  }

  if (integritiesMatch(localIntegrity, remoteIntegrity)) {
    console.log('✅ Local INTEGRITY matches remote. No update required.')
    await removeDirectory(UPDATE_DIR)
    return
  }

  console.log('⚠️  INTEGRITY mismatch detected. Update clone is available at:')
  console.log(`   ${UPDATE_DIR}`)
  console.log('You can now inspect the cloned repository or replace your local files from this clone.')
}

main().catch((error) => {
  console.error('Update check failed:', error)
  process.exit(1)
})
