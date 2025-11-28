# Generated migration for password authentication

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_update_rank_choices'),
    ]

    operations = [
        migrations.AddField(
            model_name='member',
            name='password_hash',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name='member',
            name='telegram_id',
            field=models.BigIntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.AlterField(
            model_name='member',
            name='username',
            field=models.CharField(db_index=True, max_length=255, unique=True),
        ),
        migrations.AddConstraint(
            model_name='member',
            constraint=models.UniqueConstraint(
                condition=models.Q(('telegram_id__isnull', False)),
                fields=('telegram_id',),
                name='unique_telegram_id'
            ),
        ),
    ]