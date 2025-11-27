from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Member',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('telegram_id', models.BigIntegerField(db_index=True, unique=True)),
                ('username', models.CharField(blank=True, max_length=255, null=True)),
                ('first_name', models.CharField(default='', max_length=255)),
                ('last_name', models.CharField(blank=True, default='', max_length=255)),
                ('photo_url', models.URLField(blank=True, max_length=500, null=True)),
                ('referral_code', models.CharField(db_index=True, max_length=20, unique=True)),
                ('user_type', models.CharField(choices=[('player', 'Player'), ('influencer', 'Influencer')], default='player', max_length=20)),
                ('rank', models.CharField(choices=[('standard', 'Standard'), ('silver', 'Silver'), ('gold', 'Gold'), ('platinum', 'Platinum')], default='standard', max_length=20)),
                ('v_coins_balance', models.DecimalField(decimal_places=2, default=0, max_digits=20)),
                ('cash_balance', models.DecimalField(decimal_places=2, default=0, max_digits=20)),
                ('total_deposits', models.DecimalField(decimal_places=2, default=0, max_digits=20)),
                ('active_referrals_count', models.IntegerField(default=0)),
                ('is_admin', models.BooleanField(default=False)),
                ('is_blocked', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('referrer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='referrals', to='api.member')),
            ],
            options={
                'db_table': 'members',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Withdrawal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=20)),
                ('method', models.CharField(choices=[('card', 'Bank Card'), ('crypto', 'Cryptocurrency')], max_length=20)),
                ('wallet_address', models.CharField(max_length=500)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='withdrawals', to='api.member')),
            ],
            options={
                'db_table': 'withdrawals',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Transaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount', models.DecimalField(decimal_places=2, max_digits=20)),
                ('currency_type', models.CharField(choices=[('v_coins', 'V-Coins'), ('cash', 'Cash')], max_length=20)),
                ('transaction_type', models.CharField(choices=[('referral_bonus', 'Referral Bonus'), ('depth_bonus', 'Depth Bonus'), ('deposit_percent', 'Deposit Percent'), ('withdrawal', 'Withdrawal')], max_length=30)),
                ('description', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('related_user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='related_transactions', to='api.member')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='transactions', to='api.member')),
            ],
            options={
                'db_table': 'transactions',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ReferralRelation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('level', models.IntegerField()),
                ('has_paid_first_bonus', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('ancestor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='descendant_relations', to='api.member')),
                ('descendant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ancestor_relations', to='api.member')),
            ],
            options={
                'db_table': 'referral_relations',
                'unique_together': {('ancestor', 'descendant')},
            },
        ),
        migrations.CreateModel(
            name='PushSubscription',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subscription_data', models.JSONField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='push_subscriptions', to='api.member')),
            ],
            options={
                'db_table': 'push_subscriptions',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('message', models.TextField()),
                ('notification_type', models.CharField(choices=[('bonus', 'Bonus'), ('rank_up', 'Rank Up'), ('withdrawal', 'Withdrawal'), ('system', 'System')], max_length=20)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notifications', to='api.member')),
            ],
            options={
                'db_table': 'notifications',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='withdrawal',
            index=models.Index(fields=['user', 'status'], name='withdrawals_user_id_b29c93_idx'),
        ),
        migrations.AddIndex(
            model_name='withdrawal',
            index=models.Index(fields=['status', '-created_at'], name='withdrawals_status_8e0f42_idx'),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['user', '-created_at'], name='transaction_user_id_40a583_idx'),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(fields=['transaction_type'], name='transaction_transac_df1d5f_idx'),
        ),
        migrations.AddIndex(
            model_name='referralrelation',
            index=models.Index(fields=['ancestor', 'level'], name='referral_re_ancesto_f6d3db_idx'),
        ),
        migrations.AddIndex(
            model_name='referralrelation',
            index=models.Index(fields=['descendant'], name='referral_re_descend_8ae20c_idx'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['user', 'is_read', '-created_at'], name='notificati_user_id_7c4a21_idx'),
        ),
    ]
