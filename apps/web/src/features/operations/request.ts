import { callContract, type ContractRequest } from "@/features/api/real-adapter"
import type { ApiOperationId } from "@/features/api/contract"

export function operationsRequest<T>(id: ApiOperationId, request?: ContractRequest) {
  return callContract<T>(id, request)
}
