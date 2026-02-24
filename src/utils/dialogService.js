let dialogHandlers = null;

export function registerDialogHandlers(handlers) {
    dialogHandlers = handlers;
    return () => {
        if (dialogHandlers === handlers) {
            dialogHandlers = null;
        }
    };
}

export function appAlert(message, options = {}) {
    if (dialogHandlers?.alert) {
        return dialogHandlers.alert(message, options);
    }
    if (typeof window !== 'undefined') {
        window.alert(String(message ?? ''));
    }
    return Promise.resolve();
}

export function appConfirm(message, options = {}) {
    if (dialogHandlers?.confirm) {
        return dialogHandlers.confirm(message, options);
    }
    if (typeof window !== 'undefined') {
        return Promise.resolve(window.confirm(String(message ?? '')));
    }
    return Promise.resolve(false);
}

export function appPrompt(message, options = {}) {
    if (dialogHandlers?.prompt) {
        return dialogHandlers.prompt(message, options);
    }
    if (typeof window !== 'undefined') {
        const defaultValue = options?.defaultValue ?? '';
        return Promise.resolve(window.prompt(String(message ?? ''), defaultValue));
    }
    return Promise.resolve(null);
}
