const rdf = require('rdf-ext')

function defaultGraph () {
  return rdf.dataset([rdf.quad(
    rdf.namedNode('http://example.org/subject'),
    rdf.namedNode('http://example.org/predicate'),
    rdf.literal('object')
  )])
}

function namedGraph () {
  return rdf.dataset([rdf.quad(
    rdf.namedNode('http://example.org/subject'),
    rdf.namedNode('http://example.org/predicate'),
    rdf.literal('object'),
    rdf.namedNode('http://example.org/subject')
  )])
}

module.exports = {
  defaultGraph,
  namedGraph
}
