#!/usr/bin/env node

import { runValidationEvidenceCli } from "./lib/ai-validation-evidence.mjs";

process.exitCode = runValidationEvidenceCli(process.argv.slice(2));
