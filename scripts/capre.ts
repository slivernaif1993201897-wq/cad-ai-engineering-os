import { CapreEngine } from "../server/capre";
import { RecoveryCapsuleEngine } from "../server/recoveryCapsule";

function usage(): never {
  throw new Error("Usage: pnpm capre <discover|health|capture|verify|list|inspect|restore|verify-restore|promote|rollback|recovery-drill|export-full-md|verify-full-md|restore-full-md> [checkpoint-id|capsule-path] [--staging] [--confirm]");
}

function output(value: unknown) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }

async function main() {
  const [operation, checkpointId, ...flags] = process.argv.slice(2);
  const engine = new CapreEngine({ projectRoot: process.cwd() });
  const capsule = new RecoveryCapsuleEngine({ projectRoot: process.cwd() });
  switch (operation) {
    case "discover": return output(await engine.discover());
    case "health": return output(await engine.healthGate());
    case "capture": return output(await engine.capture());
    case "list": return output(await engine.list());
    case "verify": if (!checkpointId) usage(); return output(await engine.verify(checkpointId));
    case "inspect": if (!checkpointId) usage(); return output(await engine.inspectManifest(checkpointId));
    case "restore":
      if (!checkpointId || !flags.includes("--staging")) throw new Error("CAPRE_RESTORE_REQUIRES_STAGING_FLAG");
      return output(await engine.restoreToStaging(checkpointId));
    case "verify-restore": throw new Error("CAPRE_VERIFY_RESTORE_REQUIRES_STAGING_RECEIPT_FROM_API");
    case "promote":
      if (!flags.includes("--confirm")) throw new Error("CAPRE_PROMOTE_REQUIRES_EXPLICIT_CONFIRMATION");
      return engine.promoteRestore();
    case "rollback":
      if (!flags.includes("--confirm")) throw new Error("CAPRE_ROLLBACK_REQUIRES_EXPLICIT_CONFIRMATION");
      return engine.rollback();
    case "recovery-drill": return output(await engine.recoveryDrill());
    case "export-full-md": return output(await capsule.exportFullMarkdown());
    case "verify-full-md": if (!checkpointId) usage(); return output(await capsule.verifyCapsule(checkpointId));
    case "restore-full-md":
      if (!checkpointId || !flags.includes("--staging")) throw new Error("CAPSULE_RESTORE_REQUIRES_STAGING_FLAG");
      return output(await capsule.restoreToStaging(checkpointId));
    default: return usage();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "CAPRE_OPERATION_FAILED"}\n`);
  process.exitCode = 1;
});
