import * as crypto from 'crypto';

import { IResolvers } from 'apollo-server-koa';
import * as redis from 'redis';
import * as uuid from 'uuid';

import { transaction, user, booth } from '../models';
import sequelize from 'sequelize';

const client = redis.createClient({
  host: process.env.REDIS_HOST
});

const resolver: IResolvers = {
    Query: {
        me: async (_, __, { ctx }) => ctx.user,
        users: async (_, __, { ctx }) => {
            if (!ctx.user) return null;

            const users = await user.findAll();

            return users;
        },
        booth: async (_, { bid }, { ctx }) => {
            if (!ctx.user) return null;

            const _booth = await booth.findOne({
                where: {
                    bid: bid,
                },
            });

            return _booth;
        },
        booths: async (_, __, { ctx }) => {
            if (!ctx.user) return null;

            const booths = await booth.findAll();

            return booths;
        },
        myBooths: async (_, __, { ctx }) => {
            if (!ctx.user) return null;

            const booths = await booth.findAll({
                where: {
                    pid: ctx.user.pid,
                }
            });

            return booths;
        },
        transactions: async (_, __, { ctx }) => {
            if (!ctx.user) return null;

            const transactions = await transaction.findAll();

            const result = await Promise.all(
                transactions.map(async (value, index) => {
                    let _user = await user.findOne({
                        where: {
                            pid: parseInt(value.pid.toString())
                        }
                    });
    
                    let _booth = await booth.findOne({
                        where: {
                            bid: parseInt(value.bid.toString()),
                        },
                    });
    
                    let transaction = {
                        tid: value.tid,
                        user: _user,
                        booth: _booth,
                        amount: value.amount,
                        createdAt: value.createdAt,
                        updatedAt: value.updatedAt,
                    }
    
                    return transaction;
                }),
            );

            return result;
        },
        transactionsInBooth: async (_, { bid }, { ctx }) => {
            if (!ctx.user) return null;

            const transactions = await transaction.findAll({
                where: {
                    bid: bid
                }
            });

            const _booth = await booth.findOne({
                where: {
                    bid: bid,
                },
            });

            const result = await Promise.all(
                transactions.map(async (value, index) => {
                    let _user = await user.findOne({
                        where: {
                            pid: parseInt(value.pid.toString()),
                        },
                    });
    
                    let transaction = {
                        tid: value.tid,
                        user: _user,
                        booth: _booth,
                        amount: value.amount,
                        createdAt: value.createdAt,
                        updatedAt: value.updatedAt,
                    }
    
                    return transaction;
                }),
            );

            return result;
        },
        transactionsInUser: async (_, __, { ctx }) => {
            if (!ctx.user) return null;

            const transactions = await transaction.findAll({
                where: {
                    pid: ctx.user.pid,
                }
            });

            const _user = await user.findOne({
                where: {
                    pid: ctx.user.pid,
                }
            });

            const result = await Promise.all(
                transactions.map(async (value, index) => {
                    let _booth = await booth.findOne({
                        where: {
                            bid: parseInt(value.bid.toString()),
                        },
                    });
    
                    let transaction = {
                        tid: value.tid,
                        user: _user,
                        booth: _booth,
                        amount: value.amount,
                        createdAt: value.createdAt,
                        updatedAt: value.updatedAt,
                    }
    
                    return transaction;
                }),
            );

            return result;
        }
    },
    Mutation: {
        refund: async (_, { tid }, { ctx }) => {
            if (!ctx.user) return null;

            const found = await transaction.findOne({
                where: {
                    tid: tid
                },
            });

            if (!found) return null;

            await transaction.destroy({
                where: {
                    tid: tid,
                },
            });

            const pid = parseInt(found.pid.toString());

            const updated = await user.update(
                {
                    amount: sequelize.literal(`amount - ${found.amount}`)
                },
                {
                    where: {
                        pid: pid,
                    }
                });

            if (!updated.length) return null;

            const _user = await user.findOne({
                where: {
                    pid: ctx.user.pid,
                }
            });

            const _booth = await booth.findOne({
                where: {
                    bid: parseInt(found.bid.toString()),
                },
            });

            return {
                tid: found.tid,
                user: _user,
                booth: _booth,
                amount: found.amount,
                createdAt: found.createdAt,
                updatedAt: found.updatedAt,
            };
        },
        createTransaction: async (_, { bid, amount }, { ctx }) => {
            const pid = ctx.user.pid;

            const createdTransaction = await transaction.create({
                bid: bid,
                pid: ctx.user.pid,
                amount: -amount
            });

            const updatedUser = await user.update({ amount: sequelize.literal(`amount - ${amount}`) }, { where: { pid: pid } });

            if (!updatedUser.length) return null;

            const _user = await user.findOne({
                where: {
                    pid: ctx.user.pid,
                }
            });

            const _booth = await booth.findOne({
                where: {
                    bid: bid,
                },
            });

            return {
                tid: createdTransaction.tid,
                user: _user,
                booth: _booth,
                amount: createdTransaction.amount,
                createdAt: createdTransaction.createdAt,
                updatedAt: createdTransaction.updatedAt,
            };
        },
        addAmount: async (_, { pid, amount }, { ctx }) => {
            if (!ctx.user) return null;

            const updatedUser = await user.update(
                {
                    amount: sequelize.literal(`amount + ${amount}`)
                },
                {
                    where: {
                        pid: pid,
                    }
                });

            if (!updatedUser.length) return null;

            const _user = await user.findOne({
                where: {
                    pid: pid,
                }
            })

            return _user;
        },
        Login: async (_, { id, pw }) => {
            const hash = crypto.createHash('sha512');
            hash.update(pw);
            pw = hash.digest('hex');

            const result = await user.findOne({ where: { id: id, pw: pw }, attributes: ['pid'] });

            if (!result) return { data: null }

            const session = uuid.v4();

            if (!(await client.set(session, result.pid.toString()))) {
                return { data: null }
            }

            return { data: session }
        }
    }
};

export {
    resolver,
};