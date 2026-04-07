/**
 * Dependency node system.
 * Each Node represents an edge in the reactive dependency graph.
 * Nodes form two doubly-linked lists simultaneously:
 * - Source list: all consumers of a given producer
 * - Target list: all dependencies of a given consumer
 */

import type { SignalNode } from './signal.js';
import type { ComputedNode } from './computed.js';
import type { EffectNode } from './effect.js';

/**
 * A single edge in the dependency graph.
 * Represents "target depends on source" or "source is read by target".
 */
export interface Node {
  /** The producer (signal or computed) */
  _source: SignalNode<any> | ComputedNode<any>;

  /** The consumer (computed or effect) */
  _target: ComputedNode<any> | EffectNode;

  /** Cached version of source at subscription time */
  _version: number;

  /** Previous node in source's target list */
  _prevSource: Node | null;

  /** Next node in source's target list */
  _nextSource: Node | null;

  /** Previous node in target's source list */
  _prevTarget: Node | null;

  /** Next node in target's source list */
  _nextTarget: Node | null;

  /** Saved previous node for context restoration during nested execution */
  _rollback: Node | null;
}

/**
 * Free list head for node recycling.
 * Nodes with _version === -1 are dead and available for reuse.
 */
let _freeNode: Node | null = null;

/**
 * Allocate a node from the pool or create a new one.
 */
export function allocNode(): Node {
  let node: Node;

  if (_freeNode !== null) {
    // Reuse from pool
    node = _freeNode;
    _freeNode = node._nextSource; // pool uses _nextSource as 'next' pointer
  } else {
    // Allocate new
    node = {
      _source: null as any,
      _target: null as any,
      _version: 0,
      _prevSource: null,
      _nextSource: null,
      _prevTarget: null,
      _nextTarget: null,
      _rollback: null,
    };
  }

  return node;
}

/**
 * Free a node back to the pool.
 * Marks the node as dead (_version = -1) and returns it to the free list.
 */
export function freeNode(node: Node): void {
  node._version = -1;
  node._nextSource = _freeNode;
  _freeNode = node;
}

/**
 * Link a consumer to a producer by creating or updating a dependency node.
 * This registers "target depends on source".
 *
 * @param source - The producer (signal or computed)
 * @param target - The consumer (computed or effect)
 * @returns The dependency node
 */
export function link(
  source: SignalNode<any> | ComputedNode<any>,
  target: ComputedNode<any> | EffectNode,
): Node {
  // Check if a node already exists in target's source list
  let node = target._sources;
  while (node !== null) {
    if (node._source === source) {
      // Found existing node - reuse it
      return node;
    }
    node = node._nextTarget;
  }

  // No existing node - allocate a new one
  node = allocNode();
  node._source = source;
  node._target = target;
  node._version = 0;
  node._rollback = null;

  // Insert into source's target list (prepend to head)
  node._prevSource = null;
  node._nextSource = source._targets;
  if (source._targets !== null) {
    source._targets._prevSource = node;
  }
  source._targets = node;

  // Insert into target's source list (prepend to head)
  node._prevTarget = null;
  node._nextTarget = target._sources;
  if (target._sources !== null) {
    target._sources._prevTarget = node;
  }
  target._sources = node;

  return node;
}

/**
 * Unlink a dependency node from both its source and target lists.
 * The node is then freed back to the pool.
 *
 * @param node - The node to unlink
 */
export function unlink(node: Node): void {
  const source = node._source;
  const target = node._target;

  // Remove from source's target list
  if (node._prevSource !== null) {
    node._prevSource._nextSource = node._nextSource;
  } else {
    source._targets = node._nextSource;
  }

  if (node._nextSource !== null) {
    node._nextSource._prevSource = node._prevSource;
  }

  // Remove from target's source list
  if (node._prevTarget !== null) {
    node._prevTarget._nextTarget = node._nextTarget;
  } else {
    target._sources = node._nextTarget;
  }

  if (node._nextTarget !== null) {
    node._nextTarget._prevTarget = node._prevTarget;
  }

  // Free the node
  freeNode(node);
}
