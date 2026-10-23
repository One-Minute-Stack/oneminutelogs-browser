export function createIndexedDBStore(factory, name = "oml-session-v1") {
    let connection;
    let closed = false;
    function open() {
        if (closed)
            return Promise.reject(new Error("Closed"));
        return connection ??= new Promise((resolve, reject) => {
            let failed = false;
            const fail = () => { failed = true; connection = undefined; reject(new Error("Database unavailable")); };
            const timer = setTimeout(fail, 5000);
            const request = factory.open(name, 1);
            request.onupgradeneeded = () => { request.result.createObjectStore("session"); };
            request.onerror = () => { clearTimeout(timer); fail(); };
            request.onblocked = () => { clearTimeout(timer); fail(); };
            request.onsuccess = () => {
                const db = request.result;
                clearTimeout(timer);
                if (closed || failed) {
                    db.close();
                    reject(new Error("Closed or unavailable"));
                    return;
                }
                db.onversionchange = () => { db.close(); connection = undefined; };
                resolve(db);
            };
        });
    }
    return {
        async update(decide) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction("session", "readwrite");
                const store = tx.objectStore("session");
                let result;
                const timer = setTimeout(() => { try {
                    tx.abort();
                }
                catch { } reject(new Error("Transaction timeout")); }, 5000);
                tx.oncomplete = () => { clearTimeout(timer); resolve(result); };
                tx.onabort = () => { clearTimeout(timer); reject(tx.error ?? new Error("Transaction aborted")); };
                tx.onerror = () => { };
                const read = store.get("active");
                read.onsuccess = () => {
                    try {
                        result = decide(read.result);
                        store.put(result, "active");
                    }
                    catch {
                        tx.abort();
                    }
                };
            });
        },
        close() { closed = true; void connection?.then(db => db.close(), () => { }); },
    };
}
