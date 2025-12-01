import {
    Builder,
    NucTokenEnvelope,
    Command,
    Signer
} from '@nillion/nuc';

export const generateDelegationToken = async (
  parentToken: NucTokenEnvelope,
  command: Command,
  audience: string,
  tokenExpirySeconds: number,
  signer: Signer,
) => {
  return await Builder.delegationFrom(parentToken)
      .command(command)
      .audience(audience)
      .expiresAt(Math.floor((Date.now() + tokenExpirySeconds * 1000) / 1000))
      .signAndSerialize(signer);
}



