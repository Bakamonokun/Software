#ifndef ERP_VAULT_CORE_H
#define ERP_VAULT_CORE_H

#include <stdint.h>
#include <stddef.h>

#ifdef _WIN32
  #define KANHA_EXPORT __declspec(dllexport)
#else
  #define KANHA_EXPORT __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

/* Computes CRC64-ECMA integrity checksum for .kpd / .json database archives */
KANHA_EXPORT uint64_t kanha_crc64_ecma(const uint8_t *data, size_t len);

/* Validates whether a buffer matches a supported Kanha POS (.kpd / .json / .zip / .xml) magic signature */
KANHA_EXPORT int kanha_validate_kpd_magic(const uint8_t *data, size_t len);

/* Performs lightweight stream XOR-AES vault obfuscation/deobfuscation for offline .kpd transport */
KANHA_EXPORT void kanha_vault_transform(uint8_t *buffer, size_t len, const char *secret_key);

#ifdef __cplusplus
}
#endif

#endif /* ERP_VAULT_CORE_H */
