const { strictEqual, throws } = require('assert')
const { readFileSync } = require('fs')
const { resolve } = require('path')
const { describe, it } = require('mocha')
const shell = require('shelljs')
const toFile = require('../toFile')
const example = require('./support/example')

describe('toFile', () => {
  shell.mkdir('-p', 'tmp')

  it('should be a function', () => {
    strictEqual(typeof toFile, 'function')
  })

  it('should create a quad stream', async () => {
    const filename = 'tmp/test.nt'
    await toFile(example.defaultGraph().toStream(), filename)
    const content = readFileSync(filename).toString().trim()
    const expected = readFileSync(resolve(__dirname, 'support/example.nt')).toString().trim()

    strictEqual(content, expected)
  })

  it('should throw an error if the file extension is unknown', () => {
    throws(() => {
      toFile(example.defaultGraph().toStream(), 'test.jpg')
    })
  })

  it('should throw an error if the media type is unknown', () => {
    throws(() => {
      toFile(example.defaultGraph().toStream(), 'test.jpg', {
        extensions: {
          jpg: 'image/jpeg'
        }
      })
    })
  })
})
