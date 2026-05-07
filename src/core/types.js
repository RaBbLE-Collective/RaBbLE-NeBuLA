/**
 * @typedef {'sphere'|'box'|'tetrahedron'|'plane'|'custom'} GeometryType
 */

/**
 * @typedef {Object} Entity
 * @property {string} id
 * @property {GeometryType} geometry
 * @property {unknown} [geometryData]
 * @property {[number,number,number]} position
 * @property {[number,number,number]} rotation
 * @property {[number,number,number]} scale
 * @property {Float32Array} [matrix]
 * @property {number} entropy - 0.0 to 1.0
 * @property {[number,number,number]} [color] - RGB 0-1
 * @property {number} [opacity]
 * @property {number} [lifetime]
 * @property {number} [age]
 * @property {boolean} [active]
 * @property {Record<string,unknown>} [properties]
 */

/**
 * @typedef {Object} RuntimeStats
 * @property {number} totalEntities
 * @property {number} activeStreams
 * @property {number} averageEntropy
 * @property {number} fps
 * @property {number} frameTime
 * @property {{ heap: number, entities: number }} memoryUsage
 */

/**
 * @typedef {Object} PerformanceMetrics
 * @property {number} fps
 * @property {number} frameTime
 * @property {number} drawCalls
 * @property {number} triangles
 */

/**
 * @typedef {Object} MaterialConfig
 * @property {[number,number,number]} [color]
 * @property {number} [opacity]
 * @property {boolean} [wireframe]
 */
