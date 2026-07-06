(function registerEventBus(globalObject) {
  class EventBus {
    constructor() {
      this.handlers = new Map();
    }

    on(eventName, callback) {
      if (!this.handlers.has(eventName)) {
        this.handlers.set(eventName, new Set());
      }

      this.handlers.get(eventName).add(callback);
      return () => this.off(eventName, callback);
    }

    off(eventName, callback) {
      const bucket = this.handlers.get(eventName);
      if (!bucket) {
        return;
      }

      bucket.delete(callback);
      if (bucket.size === 0) {
        this.handlers.delete(eventName);
      }
    }

    emit(eventName, payload) {
      const bucket = this.handlers.get(eventName);
      if (!bucket) {
        return;
      }

      for (const callback of bucket) {
        callback(payload);
      }
    }
  }

  globalObject.JRPG.core.EventBus = EventBus;
})(window);
