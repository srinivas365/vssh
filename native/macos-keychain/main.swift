import Foundation
import LocalAuthentication
import Security

private let service = "dev.local.vssh.vault"
private let account = "master-password"

enum KeychainError: Error {
    case unavailable
    case cancelled
    case notFound
    case failed(OSStatus)
}

private func readStdin() -> String {
    String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
}

private func touchIdAvailable() -> Bool {
    let context = LAContext()
    var error: NSError?
    return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
}

private func isEnrolled() -> Bool {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecReturnAttributes as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    return status == errSecSuccess
}

private func clearPassword() throws {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
    ]
    let status = SecItemDelete(query as CFDictionary)
    if status != errSecSuccess && status != errSecItemNotFound {
        throw KeychainError.failed(status)
    }
}

private func savePassword(_ password: String) throws {
    guard touchIdAvailable() else { throw KeychainError.unavailable }

    try clearPassword()

    guard let passwordData = password.data(using: .utf8) else {
        throw KeychainError.failed(errSecParam)
    }

    // Store without biometric ACL — unsigned/dev builds lack the entitlement
    // for kSecAttrAccessControl + biometry. Touch ID is enforced on load instead.
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecValueData as String: passwordData,
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    ]

    let status = SecItemAdd(query as CFDictionary, nil)
    if status != errSecSuccess {
        throw KeychainError.failed(status)
    }
}

private func requireBiometricAuth() throws {
    let context = LAContext()
    context.localizedReason = "Unlock vssh vault"

    var authError: NSError?
    let semaphore = DispatchSemaphore(value: 0)
    var authOk = false

    context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Unlock vssh vault") { success, error in
        authOk = success
        authError = error as NSError?
        semaphore.signal()
    }
    semaphore.wait()

    if !authOk {
        if let authError, authError.code == LAError.userCancel.rawValue || authError.code == LAError.systemCancel.rawValue {
            throw KeychainError.cancelled
        }
        throw KeychainError.cancelled
    }
}

private func loadPassword() throws -> String {
    guard touchIdAvailable() else { throw KeychainError.unavailable }
    try requireBiometricAuth()

    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
    ]

    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)

    if status == errSecItemNotFound {
        throw KeychainError.notFound
    }
    if status != errSecSuccess {
        throw KeychainError.failed(status)
    }

    guard
        let data = item as? Data,
        let password = String(data: data, encoding: .utf8)
    else {
        throw KeychainError.failed(errSecDecode)
    }

    return password
}

private func printStatus() {
    let payload: [String: Bool] = [
        "supported": true,
        "available": touchIdAvailable(),
        "enrolled": isEnrolled(),
    ]
    let data = try! JSONSerialization.data(withJSONObject: payload, options: [])
    FileHandle.standardOutput.write(data)
}

private func exitWith(_ error: KeychainError) -> Never {
    switch error {
    case .unavailable:
        fputs("touch-id-unavailable\n", stderr)
        exit(3)
    case .cancelled:
        fputs("touch-id-cancelled\n", stderr)
        exit(2)
    case .notFound:
        fputs("touch-id-not-enrolled\n", stderr)
        exit(4)
    case .failed(let status):
        fputs("touch-id-failed:\(status)\n", stderr)
        exit(1)
    }
}

guard CommandLine.arguments.count >= 2 else {
    fputs("usage: vssh-keychain <status|save|load|clear>\n", stderr)
    exit(1)
}

let command = CommandLine.arguments[1]

do {
    switch command {
    case "status":
        printStatus()
    case "save":
        let password = readStdin()
        guard !password.isEmpty else {
            fputs("touch-id-empty-password\n", stderr)
            exit(1)
        }
        try savePassword(password)
        print("ok")
    case "load":
        let password = try loadPassword()
        print(password, terminator: "")
    case "clear":
        try clearPassword()
        print("ok")
    default:
        fputs("unknown-command\n", stderr)
        exit(1)
    }
} catch let error as KeychainError {
    exitWith(error)
} catch {
    fputs("touch-id-error\n", stderr)
    exit(1)
}
