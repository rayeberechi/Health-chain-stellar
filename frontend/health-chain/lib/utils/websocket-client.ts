// WebSocketClient - Manages WebSocket connections for real-time order updates

import { io, Socket } from "socket.io-client";
import { Order } from "../types/orders";

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

export class WebSocketClient {
  private socket: Socket | null = null;
  private hospitalId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onOrderUpdateCallback?: (order: Partial<Order>) => void;
  private onConnectionChangeCallback?: (status: ConnectionStatus) => void;
  private onReconnectedCallback?: () => void;

  constructor(hospitalId: string) {
    this.hospitalId = hospitalId;
  }

  async connect(authToken?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3000";

        this.socket = io(`${wsUrl}/orders`, {
          auth: authToken ? { token: authToken } : undefined,
          // Disable socket.io built-in reconnection — we handle it manually
          // so we can emit the 'reconnecting' status with backoff control
          reconnection: false,
          transports: ["websocket", "polling"],
        });

        this.socket.on("connect", () => {
          const wasReconnecting = this.reconnectAttempts > 0;
          this.reconnectAttempts = 0;

          if (this.socket) {
            this.socket.emit("join:hospital", { hospitalId: this.hospitalId });
          }

          if (this.onConnectionChangeCallback) {
            this.onConnectionChangeCallback("connected");
          }

          // If this was a reconnect (not the initial connect), fire the reconcile callback
          if (wasReconnecting && this.onReconnectedCallback) {
            this.onReconnectedCallback();
          }

          resolve();
        });

        this.socket.on("connect_error", (error) => {
          console.error("WebSocket connection error:", error);

          if (this.reconnectAttempts === 0) {
            // First connection failed — still resolve so the page loads,
            // and start backoff reconnection
            resolve();
          }

          if (this.onConnectionChangeCallback) {
            this.onConnectionChangeCallback("disconnected");
          }

          this.scheduleReconnect(authToken);
        });

        this.socket.on("disconnect", (reason) => {
          console.log("WebSocket disconnected:", reason);

          if (this.onConnectionChangeCallback) {
            this.onConnectionChangeCallback("reconnecting");
          }

          // Server-initiated disconnect: manual reconnect required
          if (reason === "io server disconnect") {
            this.scheduleReconnect(authToken);
          } else {
            // Network drop: start reconnect loop
            this.scheduleReconnect(authToken);
          }
        });

        this.socket.on("order:updated", (update: Partial<Order>) => {
          if (this.onOrderUpdateCallback) {
            this.onOrderUpdateCallback(update);
          }
        });

        // Also listen for the gateway event name used in orders.gateway.ts
        this.socket.on("order.status.updated", (update: Partial<Order>) => {
          if (this.onOrderUpdateCallback) {
            this.onOrderUpdateCallback(update);
          }
        });
      } catch (error) {
        console.error("Error creating WebSocket connection:", error);
        reject(error);
      }
    });
  }

  private scheduleReconnect(authToken?: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      if (this.onConnectionChangeCallback) {
        this.onConnectionChangeCallback("disconnected");
      }
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s … capped at 30s
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000,
    );

    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})…`,
    );

    if (this.onConnectionChangeCallback) {
      this.onConnectionChangeCallback("reconnecting");
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.socket) {
        this.socket.connect();
      } else {
        this.connect(authToken).catch(console.error);
      }
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.onOrderUpdateCallback = undefined;
    this.onConnectionChangeCallback = undefined;
    this.onReconnectedCallback = undefined;
    this.reconnectAttempts = 0;
  }

  onOrderUpdate(callback: (order: Partial<Order>) => void): void {
    this.onOrderUpdateCallback = callback;
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void): void {
    this.onConnectionChangeCallback = callback;
  }

  /**
   * Called once after a successful reconnect so the page can
   * trigger a REST fetch to reconcile stale data.
   */
  onReconnected(callback: () => void): void {
    this.onReconnectedCallback = callback;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
