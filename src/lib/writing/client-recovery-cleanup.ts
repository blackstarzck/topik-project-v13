import {
  ClientRecoveryRepository,
  createIndexedDbClientRecoveryStorage,
} from "./client-recovery";

type CleanupRepository = Pick<
  ClientRecoveryRepository,
  "clearForAccountDeletion" | "clearForLogout"
>;
type CleanupRepositoryFactory = () => CleanupRepository;

function createDefaultRepository(): CleanupRepository {
  return new ClientRecoveryRepository(createIndexedDbClientRecoveryStorage());
}

async function runCleanup(
  operation: "account_deletion" | "logout",
  userId: string,
  createRepository: CleanupRepositoryFactory,
): Promise<boolean> {
  try {
    const repository = createRepository();
    if (operation === "logout") {
      await repository.clearForLogout(userId);
    } else {
      await repository.clearForAccountDeletion(userId);
    }
    return true;
  } catch {
    console.error("writing_recovery_cleanup_failed", { operation });
    return false;
  }
}

export function clearClientRecoveryForLogout(
  userId: string,
  createRepository: CleanupRepositoryFactory = createDefaultRepository,
): Promise<boolean> {
  return runCleanup("logout", userId, createRepository);
}

export function clearClientRecoveryForAccountDeletion(
  userId: string,
  createRepository: CleanupRepositoryFactory = createDefaultRepository,
): Promise<boolean> {
  return runCleanup("account_deletion", userId, createRepository);
}
