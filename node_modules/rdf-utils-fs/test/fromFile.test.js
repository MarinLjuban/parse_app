const { strictEqual, throws } = require('assert')
const { resolve } = require('path')
const { isReadable } = require('isstream')
const { describe, it } = require('mocha')
const rdf = require('rdf-ext')
const fromFile = require('../fromFile')
const example = require('./support/example')

describe('fromFile', () => {
  it('should create a quad stream', async () => {
    const stream = fromFile(resolve(__dirname, 'support/example.nt'))

    stream.resume()

    strictEqual(isReadable(stream), true)
  })

  it('should forward options to parser', async () => {
    const stream = fromFile(resolve(__dirname, 'support/example.ttl'), { baseIRI: 'http://example.org/' })
    const dataset = await rdf.dataset().import(stream)

    strictEqual(dataset.toCanonical(), example.defaultGraph().toCanonical())
  })

  it('should combine extensions with default', async () => {
    const extensions = {
      trig: 'application/trig'
    }

    const stream = fromFile(resolve(__dirname, 'support/example.nt'), { extensions })
    const dataset = await rdf.dataset().import(stream)

    strictEqual(dataset.toCanonical(), example.defaultGraph().toCanonical())
  })

  const commonExtensions = [
    ['json', example.defaultGraph],
    ['jsonld', example.namedGraph],
    ['n3', example.defaultGraph],
    ['trig', example.namedGraph],
    ['nq', example.namedGraph]
  ]
  for (const [extension, expected] of commonExtensions) {
    it(`should load ${extension} out of the box`, async () => {
      const stream = fromFile(resolve(__dirname, `support/example.${extension}`))
      const dataset = await rdf.dataset().import(stream)

      strictEqual(dataset.toCanonical(), expected().toCanonical())
    })
  }

  it('should throw an error if the file extension is unknown', () => {
    throws(() => {
      fromFile('test.jpg')
    })
  })

  it('should throw an error if the media type is unknown', () => {
    throws(() => {
      fromFile('test.jpg', {
        extensions: {
          jpg: 'image/jpeg'
        }
      })
    })
  })
})
