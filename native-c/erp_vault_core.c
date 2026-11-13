#include "erp_vault_core.h"
#include <stdio.h>
#include <string.h>

#define CRC64_ECMA_POLY 0x42F0E1EBA9EA3693ULL

KANHA_EXPORT uint64_t kanha_crc64_ecma(const uint8_t *data, size_t len) {
    uint64_t crc = 0xFFFFFFFFFFFFFFFFULL;
    for (size_t i = 0; i < len; i++) {
        crc ^= ((uint64_t)data[i] << 56);
        for (int b = 0; b < 8; b++) {
            if (crc & 0x8000000000000000ULL)
                crc = (crc << 1) ^ CRC64_ECMA_POLY;
            else
                crc <<= 1;
        }
    }
    return crc ^ 0xFFFFFFFFFFFFFFFFULL;
}

KANHA_EXPORT int kanha_validate_kpd_magic(const uint8_t *data, size_t len) {
    if (!data || len < 2) return 0;
    /* JSON object or array */
    if (data[0] == '{' || data[0] == '[') return 1;
    /* UTF-8 BOM + JSON */
    if (len >= 4 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF) return 1;
    /* ZIP archive (PK) */
    if (data[0] == 0x50 && data[1] == 0x4B) return 1;
    /* GZIP archive */
    if (data[0] == 0x1F && data[1] == 0x8B) return 1;
    /* XML payload */
    if (data[0] == '<') return 1;
    return 0;
}

KANHA_EXPORT void kanha_vault_transform(uint8_t *buffer, size_t len, const char *secret_key) {
    if (!buffer || len == 0 || !secret_key) return;
    size_t key_len = strlen(secret_key);
    if (key_len == 0) return;

    for (size_t i = 0; i < len; i++) {
        uint8_t k = (uint8_t)secret_key[i % key_len];
        buffer[i] ^= (uint8_t)(k ^ ((i & 0xFF) * 31));
    }
}

#ifdef KANHA_STANDALONE_CLI
int main(int argc, char **argv) {
    const char *sample = "{\"system\":\"KanhaPosErp\",\"version\":\"2.5.1d\"}";
    uint64_t crc = kanha_crc64_ecma((const uint8_t *)sample, strlen(sample));
    printf("Kanha Native C Vault Core v2.5.1d | CRC64: 0x%016llX\n", (unsigned long long)crc);
    return 0;
}
#endif
