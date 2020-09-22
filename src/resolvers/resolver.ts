import * as crypto from 'crypto';

import { IResolvers } from 'apollo-server-koa';
import * as redis from 'redis';
import * as uuid from 'uuid';

import { transaction, user, booth } from '../models';
import * as sequelize from 'sequelize';

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
        transactions: async (_, __, { ctx }) => {
            if (!ctx.user) return null;

            const transactions = await transaction.findAll();

            return transactions;
        },
        transactionsInBooth: async (_, { bid }, { ctx }) => {
            if (!ctx.user) return null;

            const transactions = await transaction.findAll({
                where: {
                    bid: bid
                }
            });

            return transactions;
        },
        transactionsInUser: async (_, __, { ctx }) => {
            if (!ctx.user) return null;

            const user = ctx.user;

            const transactions = await transaction.findAll({
                where: {
                    pid: user.pid,
                }
            });

            return transactions;
        }
    },
    Mutation: {
        refund: async(_:any, { tid }: any, { ctx }) => {
            if (!ctx.user) return null

            const user = await transaction.findOne({ where: {
                pid:ctx.user.pid,
                tid:tid
            }})
            if (!user) return null

            await transaction.destroy({ where: {
                tid : tid
            }
            })

            return user
        },
        createTransaction: async (_: any, { bid, amount }: any, { ctx }) => {
            const pid = ctx.user.pid;

            const createdTransaction = await transaction.create({
                bid: bid,
                pid: pid,
                amount: amount
            });

            const updatedUser = await user.update({ amount: sequelize.literal(`amount + ${amount}`) }, { where: { pid: pid } });
            if (!updatedUser.length) return null;
            return createdTransaction;
        },
        Login: async (_: any, {id, pw}: any, { ctx }: any) => {
            const hash = crypto.createHash('sha512');
            hash.update(pw);
            pw = hash.digest('hex');

            const result = await user.findOne({ where: { id: id, pw: pw }, attributes: ['pid'] });
            if (!result) return {data: null}

            const session = uuid.v4();

            if (!(await client.set(session, result.pid.toString()))) {
                return {data: null}
            }

            return { data: session }
        }
    }
};

export {
    resolver,
};