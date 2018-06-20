import { advanceBlock } from './helpers/advanceToBlock';
import { duration } from './helpers/increaseTime';
// import { increaseTimeTo, duration } from './helpers/increaseTime';
import latestTime from './helpers/latestTime';
// import expectThrow from './helpers/expectThrow';
import assertRevert from './helpers/assertRevert';

import shouldBeAnERC721RBACMintableToken from './ERC721/ERC721RBACMintableToken.behaviour';

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const CryptoGiftToken = artifacts.require('CryptoGiftTokenMock.sol');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

contract('CryptoGiftToken', function (accounts) {
  const name = 'CryptoGiftToken';
  const symbol = 'CGT';
  const creator = accounts[0];
  const minter = accounts[1];
  const beneficiary = accounts[2];
  const anotherAccount = accounts[3];
  const maxSupply = new BigNumber(3);
  // const anotherAccount = accounts[3];

  let tokenId;

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await advanceBlock();
  });

  beforeEach(async function () {
    this.structure = {
      sender: 'Paperino',
      receiver: 'Topolino',
      message: 'Lorem Ipsum',
      youtube: 'ABCD-123',
      date: latestTime() - duration.weeks(1),
      style: 1,
    };

    this.token = await CryptoGiftToken.new(name, symbol, maxSupply, { from: creator });
  });

  context('creating new token', function () {
    beforeEach(async function () {
      await this.token.addMinter(minter, { from: creator });
      await this.token.newToken(
        minter,
        beneficiary,
        this.structure.sender,
        this.structure.receiver,
        this.structure.message,
        this.structure.youtube,
        this.structure.date,
        this.structure.style,
        { from: minter }
      );

      tokenId = await this.token.progressiveId();
    });

    context('metadata', function () {
      let tokenStructure;

      describe('when now is greater than gift date', function () {
        let tokenVisibility;

        beforeEach(async function () {
          tokenStructure = await this.token.getGift(tokenId);
          tokenVisibility = await this.token.isVisible(tokenId);
        });

        it('should be visible', async function () {
          const visible = tokenVisibility[0];
          visible.should.be.equal(true);
        });

        describe('check metadata', function () {
          it('has a purchaser', async function () {
            const tokenPurchaser = tokenStructure[0];
            tokenPurchaser.should.be.equal(minter);
          });

          it('has a beneficiary', async function () {
            const tokenBeneficiary = tokenStructure[1];
            tokenBeneficiary.should.be.equal(beneficiary);
          });

          it('has a sender', async function () {
            const tokenSender = tokenStructure[2];
            tokenSender.should.be.equal(this.structure.sender);
          });

          it('has a receiver', async function () {
            const tokenReceiver = tokenStructure[3];
            tokenReceiver.should.be.equal(this.structure.receiver);
          });

          it('has a message', async function () {
            const tokenMessage = tokenStructure[4];
            tokenMessage.should.be.equal(this.structure.message);
          });

          it('has a youtube', async function () {
            const tokenYoutube = tokenStructure[5];
            tokenYoutube.should.be.equal(this.structure.youtube);
          });

          it('has a date', async function () {
            const tokenDate = tokenStructure[6];
            tokenDate.should.be.bignumber.equal(this.structure.date);
          });

          it('has a style', async function () {
            const tokenStyle = tokenStructure[7];
            tokenStyle.should.be.bignumber.equal(this.structure.style);
          });
        });
      });

      describe('when now is less than gift date', function () {
        let tokenVisibility;
        const giftTime = latestTime() + duration.weeks(1);

        beforeEach(async function () {
          await this.token.newToken(
            minter,
            beneficiary,
            this.structure.sender,
            this.structure.receiver,
            this.structure.message,
            this.structure.youtube,
            giftTime,
            this.structure.style,
            { from: minter }
          );

          tokenId = await this.token.progressiveId();
          tokenVisibility = await this.token.isVisible(tokenId);
        });

        it('should not be visible', async function () {
          const visible = tokenVisibility[0];
          visible.should.be.equal(false);
        });

        describe('check metadata', function () {
          it('reverts', async function () {
            await assertRevert(this.token.getGift(tokenId));
          });
        });
      });

      describe('when token is burnt', function () {
        let tokenVisibility;

        beforeEach(async function () {
          await this.token.burn(tokenId);
          tokenVisibility = await this.token.isVisible(tokenId);
        });

        it('should not be visible', async function () {
          const visible = tokenVisibility[0];
          visible.should.be.equal(false);
        });

        describe('check metadata', function () {
          it('reverts', async function () {
            await assertRevert(this.token.getGift(tokenId));
          });
        });
      });
    });

    describe('progressive id', function () {
      it('should increase', async function () {
        const oldProgressiveId = await this.token.progressiveId();

        await this.token.newToken(
          minter,
          beneficiary,
          this.structure.sender,
          this.structure.receiver,
          this.structure.message,
          this.structure.youtube,
          this.structure.date,
          this.structure.style,
          { from: minter }
        );
        const newProgressiveId = await this.token.progressiveId();

        newProgressiveId.should.be.bignumber.equal(oldProgressiveId.add(1));
      });
    });

    describe('date is equal to zero', function () {
      it('reverts', async function () {
        await assertRevert(
          this.token.newToken(
            minter,
            beneficiary,
            this.structure.sender,
            this.structure.receiver,
            this.structure.message,
            this.structure.youtube,
            0,
            this.structure.style,
            { from: minter }
          )
        );
      });
    });

    describe('if max supply has been already reached', function () {
      it('reverts', async function () {
        const oldProgressiveId = await this.token.progressiveId();
        const tokenMaxSupply = await this.token.maxSupply();
        for (let i = oldProgressiveId; i < tokenMaxSupply.valueOf(); i++) {
          await this.token.newToken(
            minter,
            beneficiary,
            this.structure.sender,
            this.structure.receiver,
            this.structure.message,
            this.structure.youtube,
            this.structure.date,
            this.structure.style,
            { from: minter }
          );
        }

        const newProgressiveId = await this.token.progressiveId();
        newProgressiveId.should.be.bignumber.equal(tokenMaxSupply);

        await assertRevert(
          this.token.newToken(
            minter,
            beneficiary,
            this.structure.sender,
            this.structure.receiver,
            this.structure.message,
            this.structure.youtube,
            this.structure.date,
            this.structure.style,
            { from: minter }
          )
        );
      });
    });

    describe('if beneficiary is the zero address', function () {
      it('reverts', async function () {
        await assertRevert(
          this.token.newToken(
            minter,
            ZERO_ADDRESS,
            this.structure.sender,
            this.structure.receiver,
            this.structure.message,
            this.structure.youtube,
            this.structure.date,
            this.structure.style,
            { from: minter }
          )
        );
      });
    });

    describe('if caller has not minter permission', function () {
      it('reverts', async function () {
        await assertRevert(
          this.token.newToken(
            minter,
            beneficiary,
            this.structure.sender,
            this.structure.receiver,
            this.structure.message,
            this.structure.youtube,
            this.structure.date,
            this.structure.style,
            { from: anotherAccount }
          )
        );
      });
    });
  });

  context('like an ERC721RBACMintableToken', function () {
    beforeEach(async function () {
      await this.token.addMinter(minter, { from: creator });
    });

    shouldBeAnERC721RBACMintableToken(accounts, creator, minter, name, symbol);
  });
});
