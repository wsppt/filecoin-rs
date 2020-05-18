use filecoin_signer::{Bip44Path, key_derive_from_seed, key_recover};
use bip39::{Language, Seed};

fn main() {
    loop {
        honggfuzz::fuzz!(|path: Bip44Path| {
            let filecoin_m = filecoin_signer::key_generate_mnemonic().unwrap();
            let bip39_m = bip39::Mnemonic::from_phrase(&filecoin_m.0, Language::English).unwrap();
            let seed = Seed::new(&bip39_m, "");
            let ek = key_derive_from_seed(seed.as_bytes(), &path).unwrap();
            let another_ek = key_recover(&ek.private_key, false).unwrap();
            assert_eq!(&ek.private_key.0[..], &another_ek.private_key.0[..]);
            assert_eq!(&ek.public_key.0[..], &another_ek.public_key.0[..]);
            assert_eq!(&ek.public_key_compressed.0[..], &another_ek.public_key_compressed.0[..]);
            assert_eq!(&ek.address[..], &another_ek.address[..]);
        });
    }
}