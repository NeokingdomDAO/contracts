// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract InternalMarketBase {
    struct Offer {
        uint256 expiredAt;
        uint256 amount;
    }

    struct Offers {
        uint128 start;
        uint128 end;
        mapping(uint128 => Offer) offer;
    }

    event OfferCreated(
        uint128 id,
        address from,
        uint256 amount,
        uint256 createdAt
    );

    event OfferMatched(uint128 id, address from, address to, uint256 amount);

    IERC20 public erc20;
    uint256 public offerDuration = 7 days;

    mapping(address => Offers) internal _offers;

    mapping(address => uint256) internal _vaultContributors;

    function _enqueue(
        Offers storage offers,
        Offer memory offer
    ) internal virtual returns (uint128) {
        offers.offer[offers.end] = offer;
        return offers.end++;
    }

    function _setERC20(IERC20 erc20_) internal virtual {
        erc20 = erc20_;
    }

    function _setOfferDuration(uint duration) internal virtual {
        offerDuration = duration;
    }

    function _makeOffer(address from, uint256 amount) internal virtual {
        erc20.transferFrom(from, address(this), amount);

        uint256 expiredAt = block.timestamp + offerDuration;
        uint128 id = _enqueue(_offers[from], Offer(expiredAt, amount));

        _vaultContributors[from] += amount;

        emit OfferCreated(id, from, amount, expiredAt);
    }

    function _beforeWithdraw(address from, uint256 amount) internal virtual {
        Offers storage offers = _offers[from];

        for (uint128 i = offers.start; i < offers.end && amount > 0; i++) {
            Offer storage offer = offers.offer[i];

            if (block.timestamp > offer.expiredAt) {
                if (amount > offer.amount) {
                    amount -= offer.amount;
                    _vaultContributors[from] -= offer.amount;
                    delete offers.offer[offers.start++];
                } else {
                    offer.amount -= amount;
                    _vaultContributors[from] -= amount;
                    amount = 0;
                }
            }
        }

        require(amount == 0, "InternalMarket: amount exceeds balance");
    }

    function _beforeMatchOffer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        Offers storage offers = _offers[from];

        for (uint128 i = offers.start; i < offers.end && amount > 0; i++) {
            Offer storage offer = offers.offer[i];
            if (block.timestamp < offer.expiredAt) {
                // If offer is active check if the amount is bigger than the
                // current offer.
                if (amount >= offer.amount) {
                    amount -= offer.amount;
                    _vaultContributors[from] -= offer.amount;

                    // Remove the offer
                    emit OfferMatched(i, from, to, offer.amount);
                    delete offers.offer[offers.start++];
                    // If the amount is smaller than the offer amount, then
                } else {
                    // 1. decrease the amount of offered tokens
                    offer.amount -= amount;
                    _vaultContributors[from] -= amount;
                    emit OfferMatched(i, from, to, amount);

                    // 2. we've exhausted the amount, set it to zero and go back
                    // to the calling function
                    amount = 0;
                }
            }
        }

        require(amount == 0, "InternalMarket: amount exceeds offer");
    }

    function _withdraw(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        _beforeWithdraw(from, amount);
        erc20.transfer(to, amount);
    }

    function _matchOffer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {
        _beforeMatchOffer(from, to, amount);
        erc20.transfer(to, amount);
    }

    function _calculateOffersOf(
        address account
    ) internal view virtual returns (uint256, uint256) {
        Offers storage offers = _offers[account];

        uint256 vault = _vaultContributors[account];
        uint256 unlocked;

        for (uint128 i = offers.start; i < offers.end; i++) {
            Offer storage offer = offers.offer[i];

            if (block.timestamp > offer.expiredAt) {
                unlocked += offer.amount;
            }
        }
        return (vault - unlocked, unlocked);
    }

    // Tokens owned by a contributor that are offered to other contributors
    function offeredBalanceOf(
        address account
    ) public view virtual returns (uint256) {
        (uint256 offered, ) = _calculateOffersOf(account);
        return offered;
    }

    // Tokens that has been offered but not bought by any other contributor
    // within the allowed timeframe.
    function withdrawableBalanceOf(
        address account
    ) public view virtual returns (uint256) {
        (, uint256 unlocked) = _calculateOffersOf(account);
        return unlocked;
    }
}
