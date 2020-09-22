import { Sequelize, DataTypes, Model, BuildOptions } from 'sequelize';

interface TransactionAttribute extends Model {
  readonly tid: bigint;
  readonly pid: bigint;
  readonly bid: bigint;
  readonly amount: number;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

type TransactionStatic = typeof Model & {
  new (values?: object, options?: BuildOptions): TransactionAttribute;
};

export const TransactionFactory = (sequelize: Sequelize) => {
  return <TransactionStatic>sequelize.define('Transaction', {
    tid: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      unique: true,
      allowNull: false,
      primaryKey: true
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  });
};
