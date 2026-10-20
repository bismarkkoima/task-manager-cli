'use strict';

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['pending', 'done'];
const SORT_KEYS = ['urgency', 'due', 'priority', 'created', 'id', 'title'];

const PRIORITY_ALIASES = {
  h: 'high',
  hi: 'high',
  high: 'high',
  m: 'medium',
  med: 'medium',
  medium: 'medium',
  l: 'low',
  lo: 'low',
  low: 'low',
};

// Projects may be nested with dots, e.g. "work.reports".
const PROJECT_PATTERN = /^[\p{L}\p{N}_-]+(\.[\p{L}\p{N}_-]+)*$/u;
const TAG_PATTERN = /^[\p{L}\p{N}_-]+$/u;

module.exports = {
  PRIORITIES,
  STATUSES,
  SORT_KEYS,
  PRIORITY_ALIASES,
  PROJECT_PATTERN,
  TAG_PATTERN,
};
