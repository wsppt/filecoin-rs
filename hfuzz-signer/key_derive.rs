use filecoin_signer::{Bip44Path, key_derive, key_generate_mnemonic, key_recover};

fn main() {
    loop {
        honggfuzz::fuzz!(|path: Bip44Path| {
            let m = key_generate_mnemonic().unwrap();
            let ek = key_derive(&m.0, &path, "").unwrap();
            let another_ek = key_recover(&ek.private_key, false).unwrap();
            assert_eq!(&ek.private_key.0[..], &another_ek.private_key.0[..]);
            assert_eq!(&ek.public_key.0[..], &another_ek.public_key.0[..]);
            assert_eq!(&ek.public_key_compressed.0[..], &another_ek.public_key_compressed.0[..]);
            assert_eq!(&ek.address[..], &another_ek.address[..]);
        });
    }
}

