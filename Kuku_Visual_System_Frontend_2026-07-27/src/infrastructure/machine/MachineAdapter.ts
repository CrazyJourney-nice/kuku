import type {
  MachineOrderStatus,
  SubmitOrderRequest,
} from "../../domain/order";
import type {
  MachineEvent,
  MachineSnapshot,
  SubmitOrderResult,
} from "./machineProtocol";

export interface MachineAdapter {
  initialize(signal?: AbortSignal): Promise<MachineSnapshot>;
  getSnapshot(signal?: AbortSignal): Promise<MachineSnapshot>;
  submitOrder(
    request: SubmitOrderRequest,
    signal?: AbortSignal,
  ): Promise<SubmitOrderResult>;
  getOrderStatus(
    clientOrderId: string,
    signal?: AbortSignal,
  ): Promise<MachineOrderStatus | null>;
  subscribe(listener: (event: MachineEvent) => void): () => void;
  requestAssistance?(): Promise<void>;
  dispose(): void;
}
