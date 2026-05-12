const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const https = require('https')
const git = require('isomorphic-git')
const http = require('isomorphic-git/http/node')

const REMOTE_URL = 'https://github.com/Sure-Development/sure_sounds'
const REMOTE_INTEGRITY_URL = 'https://raw.githubusercontent.com/Sure-Development/sure_sounds/refs/heads/main/INTEGRITY'
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

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'node.js' } }, (res) => {
      let raw = ''

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`))
        res.resume()
        return
      }

      res.setEncoding('utf8')
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw))
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
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

async function copyDirectory(src, dest) {
  await fsp.mkdir(dest, { recursive: true })
  const entries = await fsp.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else if (entry.isFile()) {
      await fsp.copyFile(srcPath, destPath)
    }
  }
}

async function cloneRepository(dir) {
  await removeDirectory(dir)
  await fsp.mkdir(dir, { recursive: true })

  console.log(`^7[INFO] [sure_sounds] ^7Cloning repository to ${dir} ...`)
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
  const remoteIntegrity = await fetchJson(REMOTE_INTEGRITY_URL)

  if (!remoteIntegrity) {
    console.error('^1[ERROR] [sure_sounds] ^7Remote INTEGRITY file not found at:', REMOTE_INTEGRITY_URL)
    process.exit(1)
  }

  if (integritiesMatch(localIntegrity, remoteIntegrity)) {
    console.log('^2[INFO] [sure_sounds] ^7Local INTEGRITY matches remote. No update required.')
    await removeDirectory(UPDATE_DIR)
    return
  }

  console.log('^3[WARNING] [sure_sounds] ^7INTEGRITY mismatch detected. Cloning latest repository...')
  await cloneRepository(UPDATE_DIR)

  const remoteSoundsPath = path.join(UPDATE_DIR, 'sounds')
  const localSoundsPath = path.join(ROOT_DIR, 'sounds')
  const remoteIntegrityPath = path.join(UPDATE_DIR, 'INTEGRITY')

  console.log('^7[INFO] [sure_sounds] ^7Replacing local sounds folder...')
  await removeDirectory(localSoundsPath)
  await copyDirectory(remoteSoundsPath, localSoundsPath)

  console.log('^7[INFO] [sure_sounds] ^7Updating local INTEGRITY file...')
  await fsp.copyFile(remoteIntegrityPath, LOCAL_INTEGRITY_PATH)

  await removeDirectory(UPDATE_DIR)
  console.log('^2[INFO] [sure_sounds] ^7Update applied successfully.')
  console.log('^2[INFO] [sure_sounds] ^7Local sounds folder and INTEGRITY file have been replaced.')
}

main().catch((error) => {
  console.error('^1[ERROR] [sure_sounds] ^7Update check failed:', error)
  process.exit(1)
})
