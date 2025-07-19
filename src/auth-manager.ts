import { existsSync, rmSync } from "fs";
import { dbOps } from "./db";

export interface AuthManager {
  hasAuth(): boolean;
  clearAuth(): void;
  getAuthStatus(): { exists: boolean; lastCleared?: string };
}

class AuthManagerImpl implements AuthManager {
  private authPath = "auth";
  
  hasAuth(): boolean {
    return existsSync(this.authPath);
  }
  
  clearAuth(): void {
    if (existsSync(this.authPath)) {
      console.log("🗑️ Clearing authentication files...");
      rmSync(this.authPath, { recursive: true, force: true });
      
      // Log the clear event
      const timestamp = new Date().toISOString();
      this.logAuthClear(timestamp);
      
      console.log("✅ Auth files cleared successfully");
    }
  }
  
  getAuthStatus(): { exists: boolean; lastCleared?: string } {
    const exists = this.hasAuth();
    const lastCleared = this.getLastClearTime();
    
    return {
      exists,
      ...(lastCleared && { lastCleared })
    };
  }
  
  private logAuthClear(timestamp: string): void {
    // Store in a simple key-value table or as metadata
    try {
      // You could extend the database to track auth events
      console.log(`📝 Auth cleared at: ${timestamp}`);
    } catch (error) {
      console.error("Failed to log auth clear event:", error);
    }
  }
  
  private getLastClearTime(): string | null {
    // Retrieve from database or metadata file
    return null; // Implement based on your storage preference
  }
}

export const authManager = new AuthManagerImpl();