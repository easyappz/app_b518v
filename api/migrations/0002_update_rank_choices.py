from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='member',
            name='rank',
            field=models.CharField(
                choices=[
                    ('bronze', 'Bronze'),
                    ('silver', 'Silver'),
                    ('gold', 'Gold'),
                    ('platinum', 'Platinum'),
                    ('diamond', 'Diamond')
                ],
                default='bronze',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='member',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name='withdrawal',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('processing', 'Processing'),
                    ('completed', 'Completed'),
                    ('rejected', 'Rejected'),
                    ('approved', 'Approved')
                ],
                default='pending',
                max_length=20
            ),
        ),
        migrations.AlterField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('referral_bonus', 'Referral Bonus'),
                    ('tournament_bonus', 'Tournament Bonus'),
                    ('deposit_bonus', 'Deposit Bonus'),
                    ('withdrawal_approved', 'Withdrawal Approved'),
                    ('withdrawal_rejected', 'Withdrawal Rejected'),
                    ('rank_upgrade', 'Rank Upgrade'),
                    ('system', 'System')
                ],
                max_length=30
            ),
        ),
    ]