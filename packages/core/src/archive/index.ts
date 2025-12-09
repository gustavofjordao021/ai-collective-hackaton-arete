/**
 * Archive module exports
 */

export {
  findExpiredFacts,
  archiveFacts,
  runArchiveCleanup,
  getArchiveDir,
  getConfigDir,
  setConfigDir,
  DEFAULT_ARCHIVE_THRESHOLD,
  type CleanupResult,
} from "./archive.js";
