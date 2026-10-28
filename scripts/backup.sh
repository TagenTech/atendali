#!/bin/sh
# Backup do Postgres criptografado (AES-256, chave derivada com PBKDF2) com retenção.
# Variáveis: PGHOST, PGUSER, PGPASSWORD, PGDATABASE, BACKUP_PASSPHRASE (obrigatória),
#            BACKUP_DIR (padrão /backups), KEEP_DAYS (padrão 14).
#
# Restaurar:
#   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE \
#     -in agendei-AAAAMMDD-HHMMSS.dump.enc | pg_restore --clean --no-owner -d "$PGDATABASE"
set -eu
: "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE (backups não ficam sem criptografia)}"
DIR="${BACKUP_DIR:-/backups}"
KEEP="${KEEP_DAYS:-14}"
umask 077
mkdir -p "$DIR"
FILE="$DIR/agendei-$(date +%Y%m%d-%H%M%S).dump.enc"
pg_dump --format=custom --no-owner | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$FILE"
echo "Backup criptografado: $FILE"
find "$DIR" -name 'agendei-*.dump*' -mtime +"$KEEP" -delete
