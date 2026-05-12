#!/usr/bin/env bun
import { readdir, stat } from 'fs/promises'
import { createHash } from 'crypto'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

const SOUNDS_DIR = path.join(import.meta.dir, 'sounds')
const INTEGRITY_FILE = path.join(import.meta.dir, 'INTEGRITY')

/**
 * Recursively read all files from a directory
 */
async function* walkDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    
    if (entry.isDirectory()) {
      yield* walkDir(fullPath)
    } else if (entry.isFile()) {
      yield fullPath
    }
  }
}

/**
 * Calculate SHA256 hash of a file
 */
async function hashFile(filePath) {
  const content = await readFile(filePath)
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Generate integrity data for all files in sounds directory
 */
async function generateIntegrity() {
  const integrity = {}
  const startTime = Date.now()
  let fileCount = 0

  console.log('📂 Scanning sounds directory...')

  try {
    for await (const filePath of walkDir(SOUNDS_DIR)) {
      const relativePath = path.relative(SOUNDS_DIR, filePath)
      const fileSize = (await stat(filePath)).size
      const hash = await hashFile(filePath)

      integrity[relativePath] = {
        hash,
        size: fileSize,
        timestamp: new Date().toISOString(),
      }

      fileCount++
      console.log(`✓ ${relativePath} (${fileSize} bytes)`)
    }

    // Add metadata
    const data = {
      version: '1.0',
      generated: new Date().toISOString(),
      fileCount,
      files: integrity,
    }

    // Write to INTEGRITY file
    await writeFile(INTEGRITY_FILE, JSON.stringify(data, null, 2))

    const duration = Date.now() - startTime
    console.log(
      `\n✅ Integrity file updated successfully!\n📊 ${fileCount} files processed in ${duration}ms\n📝 Written to: ${INTEGRITY_FILE}`
    )
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠️  Sounds directory not found. Creating empty integrity file...')
      const data = {
        version: '1.0',
        generated: new Date().toISOString(),
        fileCount: 0,
        files: {},
      }
      await writeFile(INTEGRITY_FILE, JSON.stringify(data, null, 2))
      console.log('✅ Empty integrity file created.')
    } else {
      throw error
    }
  }
}

// Run the script
await generateIntegrity()
